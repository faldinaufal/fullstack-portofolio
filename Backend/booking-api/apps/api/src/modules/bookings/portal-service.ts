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
import { recordAudit, type AuditActor } from '../../lib/audit.js';
import type { PaymentProvider } from '../../lib/payments/provider.js';
import type { TokenHasher } from '../../lib/tokens.js';
import { locateBooking, type BookingViewer, type LocatedBooking } from './access.js';
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

const notCancellable = () =>
  new AppError({
    status: 409,
    code: 'NOT_CANCELLABLE',
    title: 'Booking cannot be cancelled here',
    detail:
      'Only bookings that are still waiting for payment can be cancelled online. Please contact the business.',
  });

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
      const at = now();
      const byCustomer = found.via === 'customer' ? viewer.customerAccountId : null;
      const result = await inTenant(found.tenantId, async (tx) => {
        const booking = await tx.booking.findUniqueOrThrow({
          where: { id: bookingId },
          include: { tenantCustomer: true, invoice: true },
        });
        const { count } = await tx.booking.updateMany({
          where: { id: bookingId, status: 'pending_payment', holdExpiresAt: { gt: at } },
          data: {
            status: 'cancelled',
            cancelledAt: at,
            cancelledByType: byCustomer ? 'customer' : 'guest',
            cancelledById: byCustomer,
            cancelReason: 'Cancelled before payment',
            holdExpiresAt: null,
            version: { increment: 1 },
          },
        });
        if (count === 0) throw notCancellable();

        const open = await tx.payment.findMany({
          where: { invoiceId: booking.invoice!.id, status: 'pending' },
        });
        await tx.invoice.update({
          where: { id: booking.invoice!.id },
          data: { status: 'void', voidedAt: at, voidReason: 'Booking cancelled before payment' },
        });
        await tx.payment.updateMany({
          where: { invoiceId: booking.invoice!.id, status: 'pending' },
          data: { status: 'expired' },
        });
        const actor: AuditActor = {
          type: 'customer',
          id: byCustomer,
          label: byCustomer
            ? booking.tenantCustomer.name
            : `${booking.tenantCustomer.name} (guest)`,
          ip,
        };
        await recordAudit(tx, actor, {
          tenantId: booking.tenantId,
          branchId: booking.branchId,
          action: 'booking.cancelled',
          entityType: 'booking',
          entityId: booking.id,
          before: { status: 'pending_payment' },
          after: { status: 'cancelled' },
          reason: 'Cancelled before payment',
        });
        return { sessions: open.map((p) => p.checkoutSessionId) };
      });

      // After the commit: close the Checkout so it cannot be paid. If this fails, a payment that
      // still arrives is flagged by the webhook's safety net (FSD 6.4) instead of confirming.
      for (const sessionId of result.sessions) {
        await payments.expireCheckout(sessionId).catch(() => undefined);
      }
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
