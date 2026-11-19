// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type {
  CheckoutLink,
  PortalBookingDetail,
  PortalBookingList,
  PortalBookingListQuery,
} from '@tempora/contracts';
import { withDbContext, type Prisma, type PrismaClient, type Tx } from '@tempora/db';
import { AppError } from '../../lib/app-error.js';
import type { PaymentProvider } from '../../lib/payments/provider.js';
import type { TokenHasher } from '../../lib/tokens.js';
import { locateBooking, type BookingViewer, type LocatedBooking } from './access.js';
import { cancelBooking, closeCheckouts } from './cancel.js';
import { createPortalInvoices } from './invoices.js';
import { createReschedule } from './reschedule.js';
import { portalBookingDetail, portalBookings } from './views.js';

export interface PortalBookingServiceDeps {
  prisma: PrismaClient;
  payments: PaymentProvider;
  hashToken: TokenHasher;
  timeZone: string;
  portalUrl: string;
  now?: () => Date;
}

const holdExpired = () =>
  new AppError({
    status: 409,
    code: 'HOLD_EXPIRED',
    title: 'Nothing to pay',
    detail: 'This booking is no longer waiting for payment.',
  });

/**
 * What customers and guests do with their bookings in the Portal (FSD 5.3, 6.5, 6.7): "My
 * bookings", one booking's detail, resuming payment, cancelling an unpaid booking,
 * rescheduling (`reschedule.ts`) and invoices (`invoices.ts`).
 */
export function createPortalBookingService({
  prisma,
  payments,
  hashToken,
  timeZone,
  portalUrl,
  now = () => new Date(),
}: PortalBookingServiceDeps) {
  const inTenant = <T>(tenantId: string, work: (tx: Tx) => Promise<T>) =>
    withDbContext(prisma, { tenantId }, work);

  const locate = (viewer: BookingViewer, bookingId: string | null) =>
    locateBooking(prisma, hashToken, viewer, bookingId, now());

  const load = (found: LocatedBooking) =>
    inTenant(found.tenantId, (tx) => portalBookingDetail(tx, found.bookingId, now(), timeZone));
  const detailOf = async (found: LocatedBooking) => (await load(found)).detail;

  const core = {
    /** My bookings across every business (customer policy), newest relevant first. */
    async list(
      customerAccountId: string,
      query: PortalBookingListQuery,
    ): Promise<PortalBookingList> {
      const at = now();
      const upcoming: Prisma.BookingWhereInput = {
        endsAt: { gt: at },
        OR: [{ status: 'confirmed' }, { status: 'pending_payment', holdExpiresAt: { gt: at } }],
      };
      const where = query.when === 'upcoming' ? upcoming : { NOT: upcoming };
      const { rows, total } = await withDbContext(prisma, { customerAccountId }, async (tx) => ({
        total: await tx.booking.count({ where }),
        rows: await tx.booking.findMany({
          where,
          orderBy: { startsAt: query.when === 'upcoming' ? 'asc' : 'desc' },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
          select: { id: true, tenantId: true },
        }),
      }));

      // Names of businesses, branches and therapists are read in each business's own context.
      const items = new Map<string, PortalBookingList['items'][number]>();
      for (const tenantId of new Set(rows.map((r) => r.tenantId))) {
        const ids = rows.filter((r) => r.tenantId === tenantId).map((r) => r.id);
        for (const booking of await inTenant(tenantId, (tx) =>
          portalBookings(tx, ids, at, timeZone),
        )) {
          items.set(booking.id, booking);
        }
      }
      return {
        items: rows.flatMap((r) => items.get(r.id) ?? []),
        page: query.page,
        pageSize: query.pageSize,
        total,
      };
    },

    async detail(viewer: BookingViewer, bookingId: string): Promise<PortalBookingDetail> {
      return detailOf(await locate(viewer, bookingId));
    },

    /** `/manage/[token]`: the booking the link belongs to. */
    async guestBooking(guestToken: string): Promise<PortalBookingDetail> {
      return detailOf(await locate({ customerAccountId: null, guestToken }, null));
    },

    /** Resume payment: the Checkout that is still open (FSD 3.1 "customer closes the tab"). */
    async checkout(viewer: BookingViewer, bookingId: string): Promise<CheckoutLink> {
      const { detail, checkoutUrl } = await load(await locate(viewer, bookingId));
      if (!detail.actions.pay || !checkoutUrl) throw holdExpired();
      return { checkoutUrl };
    },

    /** FSD 6.7 "Cancel unpaid": the slot is free at once; the open Checkout is closed after. */
    async cancel(
      viewer: BookingViewer,
      bookingId: string,
      ip: string,
    ): Promise<PortalBookingDetail> {
      const found = await locate(viewer, bookingId);
      const byCustomer = found.via === 'customer' ? viewer.customerAccountId : null;
      const { sessions } = await inTenant(found.tenantId, async (tx) => {
        const customer = await tx.booking.findUniqueOrThrow({
          where: { id: bookingId },
          select: { tenantCustomer: { select: { name: true } } },
        });
        const name = customer.tenantCustomer.name;
        return cancelBooking(tx, bookingId, {
          now: now(),
          actor: {
            type: 'customer',
            id: byCustomer,
            label: byCustomer ? name : `${name} (guest)`,
            ip,
          },
          by: { type: byCustomer ? 'customer' : 'guest', id: byCustomer },
          allowPaid: false,
          reason: undefined,
          notify: null,
        });
      });
      await closeCheckouts(payments, sessions);
      return detailOf(found);
    },
  };

  return {
    ...core,
    ...createReschedule({
      inTenant,
      locate,
      detailOf,
      emails: { hashToken, portalUrl, timeZone },
      timeZone,
      now,
    }),
    ...createPortalInvoices({ prisma, inTenant, locate, timeZone }),
  };
}

export type PortalBookingService = ReturnType<typeof createPortalBookingService>;
