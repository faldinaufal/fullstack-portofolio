// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { TZDate } from '@date-fns/tz';
import type {
  PortalInvoice,
  PortalInvoiceList,
  PortalInvoiceListQuery,
  PortalInvoiceTotals,
} from '@tempora/contracts';
import { withDbContext, type Prisma, type PrismaClient, type Tx } from '@tempora/db';
import { displayName } from '../public/service.js';
import type { BookingViewer, LocatedBooking } from './access.js';

export interface InvoiceDeps {
  prisma: PrismaClient;
  inTenant: <T>(tenantId: string, work: (tx: Tx) => Promise<T>) => Promise<T>;
  locate: (viewer: BookingViewer, bookingId: string) => Promise<LocatedBooking>;
  timeZone: string;
  now?: () => Date;
}

/** `status` and `q` (invoice number, business or service name) of the Invoices page. */
function invoiceFilter(query: PortalInvoiceListQuery): Prisma.InvoiceWhereInput {
  const contains = query.q && { contains: query.q, mode: 'insensitive' as const };
  return {
    ...(query.status && { status: query.status }),
    ...(contains && {
      OR: [
        { number: contains },
        { booking: { serviceName: contains } },
        { booking: { tenant: { name: contains } } },
      ],
    }),
  };
}

/** Invoices in the Portal (FSD 5.3, 6.10): a customer's list, and one booking's invoice. */
export function createPortalInvoices({
  prisma,
  inTenant,
  locate,
  timeZone,
  now = () => new Date(),
}: InvoiceDeps) {
  return {
    /**
     * Every invoice of the customer's bookings at any business, newest first. The customer
     * policy decides what is visible; business names come from the public `tenants` table.
     */
    async invoices(
      customerAccountId: string,
      query: PortalInvoiceListQuery,
    ): Promise<PortalInvoiceList> {
      const where = invoiceFilter(query);
      return withDbContext(prisma, { customerAccountId }, async (tx) => {
        const total = await tx.invoice.count({ where });
        const rows = await tx.invoice.findMany({
          where,
          orderBy: { issuedAt: 'desc' },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
          include: {
            booking: { select: { serviceName: true, tenant: { select: { name: true } } } },
          },
        });
        return {
          items: rows.map((row) => ({
            bookingId: row.bookingId,
            number: row.number,
            status: row.status,
            amountCents: row.amountCents,
            issuedAt: row.issuedAt.toISOString(),
            paidAt: row.paidAt?.toISOString() ?? null,
            businessName: row.booking.tenant.name,
            serviceName: row.booking.serviceName,
          })),
          page: query.page,
          pageSize: query.pageSize,
          total,
        };
      });
    },

    /**
     * Totals for the Invoices page: paid during this calendar year (platform time zone, like
     * invoice numbers, FSD 6.10) and everything still open.
     */
    async invoiceTotals(customerAccountId: string): Promise<PortalInvoiceTotals> {
      const year = new TZDate(now(), timeZone).getFullYear();
      const from = new TZDate(year, 0, 1, timeZone);
      const until = new TZDate(year + 1, 0, 1, timeZone);
      return withDbContext(prisma, { customerAccountId }, async (tx) => {
        const paid = await tx.invoice.aggregate({
          where: { status: 'paid', paidAt: { gte: from, lt: until } },
          _count: true,
          _sum: { amountCents: true },
        });
        const open = await tx.invoice.aggregate({
          where: { status: 'open' },
          _count: true,
          _sum: { amountCents: true },
        });
        return {
          year,
          paid: { count: paid._count, amountCents: paid._sum.amountCents ?? 0 },
          open: { count: open._count, amountCents: open._sum.amountCents ?? 0 },
        };
      });
    },

    /** One booking's invoice; the same access rules as the booking (session or link). */
    async invoice(viewer: BookingViewer, bookingId: string): Promise<PortalInvoice> {
      const found = await locate(viewer, bookingId);
      return inTenant(found.tenantId, async (tx) => {
        const invoice = await tx.invoice.findUniqueOrThrow({
          where: { bookingId },
          include: {
            booking: {
              include: {
                tenant: true,
                branch: true,
                tenantCustomer: true,
                staff: { include: { teamAccount: true } },
              },
            },
          },
        });
        const { booking } = invoice;
        return {
          bookingId,
          number: invoice.number,
          status: invoice.status,
          currency: invoice.currency,
          amountCents: invoice.amountCents,
          issuedAt: invoice.issuedAt.toISOString(),
          paidAt: invoice.paidAt?.toISOString() ?? null,
          voidedAt: invoice.voidedAt?.toISOString() ?? null,
          voidReason: invoice.voidReason,
          business: { name: booking.tenant.name, slug: booking.tenant.slug },
          branch: { name: booking.branch.name, address: booking.branch.address },
          billedTo: { name: booking.tenantCustomer.name, email: booking.tenantCustomer.email },
          line: {
            description: booking.serviceName,
            therapist: displayName(booking.staff.teamAccount.name),
            startsAt: booking.startsAt.toISOString(),
            durationMinutes: booking.durationMinutes,
          },
          timeZone,
        };
      });
    },
  };
}
