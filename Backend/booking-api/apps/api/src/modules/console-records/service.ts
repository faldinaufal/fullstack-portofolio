// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type {
  ConsoleCustomer,
  ConsoleCustomerDetail,
  ConsoleInvoice,
  ConsoleInvoiceDetail,
  CustomerList,
  CustomerListQuery,
  CustomerSummary,
  InvoiceList,
  InvoiceListQuery,
} from '@tempora/contracts';
import { Prisma, withDbContext, type PrismaClient, type Tx } from '@tempora/db';
import { csvAmount, csvDateTime, csvStream } from '../../lib/csv.js';
import { todayIn } from '../availability/engine.js';
import { notFound, viewerContext, type Viewer } from '../console-auth/access.js';
import type { ConsoleActor } from '../console-auth/guard.js';
import {
  auditExport,
  BOOKING_ROW_INCLUDE,
  dateRange,
  exportFileName,
  toConsoleBooking,
} from '../console-bookings/rows.js';
import { displayName, escapeLike } from '../public/service.js';

interface CustomerAggregate {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  has_account: boolean;
  booking_count: number;
  last_visit_at: Date | null;
  next_booking_at: Date | null;
}

const INVOICE_INCLUDE = {
  booking: {
    select: {
      id: true,
      serviceName: true,
      branch: { select: { id: true, name: true } },
      tenantCustomer: { select: { id: true, name: true } },
    },
  },
} as const;

type InvoiceRow = Prisma.InvoiceGetPayload<{ include: typeof INVOICE_INCLUDE }>;

const DAY = 24 * 60 * 60 * 1000;

export interface ConsoleRecordsDeps {
  prisma: PrismaClient;
  timeZone: string;
  now?: () => Date;
}

/**
 * Customers and invoices in the Console (FSD 2.2, 5.4): owner and managers. A manager sees the
 * customers who booked at their branch, with figures for that branch only, and the invoices
 * of their branch's bookings. Routes allow only owner and manager.
 */
export function createConsoleRecordsService({
  prisma,
  timeZone,
  now = () => new Date(),
}: ConsoleRecordsDeps) {
  const inTenant = <T>(viewer: Viewer, work: (tx: Tx) => Promise<T>) =>
    withDbContext(prisma, viewerContext(viewer), work);

  /** The manager's branch, or null for the owner (every branch). */
  const branchOf = (actor: Viewer) => (actor.role === 'manager' ? actor.branchId : null);

  // --- customers ------------------------------------------------------------

  /**
   * One query for the whole page: each customer with their booking figures. Joining only the
   * bookings in scope is what limits a manager to customers of their branch. "Booked" counts
   * bookings that held a time for real (confirmed, completed, no-show); the last visit is the
   * latest one that took place; the next is the earliest one still to come.
   */
  function customerQuery(
    actor: Viewer,
    query: Pick<CustomerListQuery, 'q' | 'sort'>,
    at: Date,
    paging: { limit: number; offset: number } | null,
    customerId?: string,
  ) {
    const branch = branchOf(actor);
    const like = query.q ? `%${escapeLike(query.q)}%` : null;
    return Prisma.sql`
      SELECT c.id, c.name, c.email, c.phone, c.customer_account_id IS NOT NULL AS has_account,
        count(b.id) FILTER (WHERE b.status IN ('confirmed', 'completed', 'no_show'))::int AS booking_count,
        max(b.starts_at) FILTER (
          WHERE b.status = 'completed' OR (b.status = 'confirmed' AND b.ends_at <= ${at})
        ) AS last_visit_at,
        min(b.starts_at) FILTER (
          WHERE b.starts_at > ${at}
            AND (b.status = 'confirmed' OR (b.status = 'pending_payment' AND b.hold_expires_at > ${at}))
        ) AS next_booking_at
      FROM tenant_customers c
      JOIN bookings b ON b.tenant_customer_id = c.id
        ${branch ? Prisma.sql`AND b.branch_id = ${branch}::uuid` : Prisma.empty}
      WHERE TRUE
        ${customerId ? Prisma.sql`AND c.id = ${customerId}::uuid` : Prisma.empty}
        ${like ? Prisma.sql`AND (c.name ILIKE ${like} OR c.email LIKE lower(${like}))` : Prisma.empty}
      GROUP BY c.id
      ${
        query.sort === '-lastVisit'
          ? Prisma.sql`ORDER BY last_visit_at DESC NULLS LAST, c.name, c.id`
          : Prisma.sql`ORDER BY c.name, c.id`
      }
      ${paging ? Prisma.sql`LIMIT ${paging.limit} OFFSET ${paging.offset}` : Prisma.empty}`;
  }

  const toCustomer = (row: CustomerAggregate): ConsoleCustomer => ({
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    hasAccount: row.has_account,
    bookingCount: row.booking_count,
    lastVisitAt: row.last_visit_at?.toISOString() ?? null,
    nextBookingAt: row.next_booking_at?.toISOString() ?? null,
  });

  async function countCustomers(tx: Tx, actor: Viewer, query: Omit<CustomerListQuery, 'format'>) {
    const [row] = await tx.$queryRaw<{ total: number }[]>`
      SELECT count(*)::int AS total FROM (${customerQuery(actor, query, now(), null)}) AS scoped`;
    return row?.total ?? 0;
  }

  /**
   * The Customers page's figure cards in one aggregate query: per customer in scope (same join
   * as the list, so a manager counts only their branch), then counted with `FILTER`s. The
   * database does the counting; nothing per customer reaches the API.
   */
  async function customerSummary(tx: Tx, actor: Viewer): Promise<CustomerSummary> {
    const branch = branchOf(actor);
    const at = now();
    const today = todayIn(timeZone, at);
    const monthStart = dateRange(timeZone, `${today.slice(0, 8)}01`, undefined)!.gte!;
    const weekAhead = new Date(at.getTime() + 7 * DAY);
    const ninetyDaysAgo = new Date(at.getTime() - 90 * DAY);
    const [row] = await tx.$queryRaw<
      {
        total: number;
        new_this_month: number;
        returning: number;
        booked_ahead: number;
        no_shows: number;
        upcoming_sessions: number;
      }[]
    >`
      WITH scoped AS (
        SELECT c.id,
          count(b.id) FILTER (WHERE b.status IN ('confirmed', 'completed', 'no_show')) AS booked,
          min(b.created_at) FILTER (WHERE b.status IN ('confirmed', 'completed', 'no_show')) AS first_booked_at,
          bool_or(b.starts_at > ${at} AND (
            b.status = 'confirmed' OR (b.status = 'pending_payment' AND b.hold_expires_at > ${at})
          )) AS ahead,
          bool_or(b.status = 'no_show' AND b.starts_at >= ${ninetyDaysAgo}) AS no_show,
          count(b.id) FILTER (
            WHERE b.status = 'confirmed' AND b.starts_at > ${at} AND b.starts_at <= ${weekAhead}
          ) AS upcoming
        FROM tenant_customers c
        JOIN bookings b ON b.tenant_customer_id = c.id
          ${branch ? Prisma.sql`AND b.branch_id = ${branch}::uuid` : Prisma.empty}
        GROUP BY c.id
      )
      SELECT count(*)::int AS total,
        count(*) FILTER (WHERE first_booked_at >= ${monthStart})::int AS new_this_month,
        count(*) FILTER (WHERE booked >= 2)::int AS returning,
        count(*) FILTER (WHERE ahead)::int AS booked_ahead,
        count(*) FILTER (WHERE no_show)::int AS no_shows,
        coalesce(sum(upcoming), 0)::int AS upcoming_sessions
      FROM scoped`;
    return {
      total: row?.total ?? 0,
      newThisMonth: row?.new_this_month ?? 0,
      returning: row?.returning ?? 0,
      bookedAhead: row?.booked_ahead ?? 0,
      upcomingSessions: row?.upcoming_sessions ?? 0,
      noShows: row?.no_shows ?? 0,
    };
  }

  const customerPage = (
    tx: Tx,
    actor: Viewer,
    query: Omit<CustomerListQuery, 'format'>,
    n: number,
    size: number,
  ) =>
    tx.$queryRaw<CustomerAggregate[]>(
      customerQuery(actor, query, now(), { limit: size, offset: (n - 1) * size }),
    );

  // --- invoices -------------------------------------------------------------

  function invoiceWhere(
    actor: Viewer,
    query: Omit<InvoiceListQuery, 'format'>,
  ): Prisma.InvoiceWhereInput {
    const branch = branchOf(actor) ?? query.branchId;
    const issuedAt = dateRange(timeZone, query.from, query.to);
    return {
      ...(branch && { booking: { branchId: branch } }),
      ...(query.status && { status: query.status }),
      ...(issuedAt && { issuedAt }),
      ...(query.q && {
        OR: [
          { number: { contains: query.q.toUpperCase() } },
          { booking: { tenantCustomer: { name: { contains: query.q, mode: 'insensitive' } } } },
        ],
      }),
    };
  }

  const invoicePage = (tx: Tx, where: Prisma.InvoiceWhereInput, n: number, size: number) =>
    tx.invoice.findMany({
      where,
      include: INVOICE_INCLUDE,
      orderBy: [{ issuedAt: 'desc' }, { id: 'asc' }],
      skip: (n - 1) * size,
      take: size,
    });

  const toInvoice = (row: InvoiceRow): ConsoleInvoice => ({
    id: row.id,
    number: row.number,
    status: row.status,
    amountCents: row.amountCents,
    currency: row.currency,
    issuedAt: row.issuedAt.toISOString(),
    paidAt: row.paidAt?.toISOString() ?? null,
    voidedAt: row.voidedAt?.toISOString() ?? null,
    bookingId: row.booking.id,
    serviceName: row.booking.serviceName,
    branch: row.booking.branch,
    customer: row.booking.tenantCustomer,
  });

  const withoutPaging = <T extends { page: number; pageSize: number; format: string }>({
    page: _page,
    pageSize: _size,
    format: _format,
    ...filters
  }: T) => filters;

  return {
    customers: (actor: Viewer, query: Omit<CustomerListQuery, 'format'>): Promise<CustomerList> =>
      inTenant(actor, async (tx) => ({
        items: (await customerPage(tx, actor, query, query.page, query.pageSize)).map(toCustomer),
        page: query.page,
        pageSize: query.pageSize,
        total: await countCustomers(tx, actor, query),
        timeZone,
      })),

    customerSummary: (actor: Viewer): Promise<CustomerSummary> =>
      inTenant(actor, (tx) => customerSummary(tx, actor)),

    async exportCustomers(actor: ConsoleActor, query: CustomerListQuery) {
      await inTenant(actor, async (tx) =>
        auditExport(
          tx,
          actor,
          'customers',
          withoutPaging(query),
          await countCustomers(tx, actor, query),
        ),
      );
      return {
        fileName: exportFileName('customers', now()),
        stream: csvStream(
          ['Name', 'Email', 'Phone', 'Portal account', 'Bookings', 'Last visit', 'Next booking'],
          (n, size) => inTenant(actor, (tx) => customerPage(tx, actor, query, n, size)),
          (row) => [
            row.name,
            row.email,
            row.phone,
            row.has_account ? 'yes' : 'no',
            row.booking_count,
            csvDateTime(row.last_visit_at, timeZone),
            csvDateTime(row.next_booking_at, timeZone),
          ],
        ),
      };
    },

    /** A customer outside the manager's branch does not exist for them (`404`). */
    customer: (actor: Viewer, id: string): Promise<ConsoleCustomerDetail> =>
      inTenant(actor, async (tx) => {
        const [row] = await tx.$queryRaw<CustomerAggregate[]>(
          customerQuery(actor, { sort: 'name' }, now(), null, id),
        );
        if (!row) throw notFound('Customer');
        const branch = branchOf(actor);
        const bookings = await tx.booking.findMany({
          where: { tenantCustomerId: id, ...(branch && { branchId: branch }) },
          include: BOOKING_ROW_INCLUDE,
          orderBy: { startsAt: 'desc' },
          take: 100,
        });
        return {
          ...toCustomer(row),
          bookings: bookings.map((b) => toConsoleBooking(b, actor, now())),
          timeZone,
        };
      }),

    invoices: (actor: Viewer, query: Omit<InvoiceListQuery, 'format'>): Promise<InvoiceList> =>
      inTenant(actor, async (tx) => {
        const where = invoiceWhere(actor, query);
        return {
          items: (await invoicePage(tx, where, query.page, query.pageSize)).map(toInvoice),
          page: query.page,
          pageSize: query.pageSize,
          total: await tx.invoice.count({ where }),
          timeZone,
        };
      }),

    async exportInvoices(actor: ConsoleActor, query: InvoiceListQuery) {
      const where = invoiceWhere(actor, query);
      await inTenant(actor, async (tx) =>
        auditExport(tx, actor, 'invoices', withoutPaging(query), await tx.invoice.count({ where })),
      );
      return {
        fileName: exportFileName('invoices', now()),
        stream: csvStream(
          [
            'Number',
            'Status',
            'Issued',
            'Paid',
            'Amount',
            'Currency',
            'Customer',
            'Service',
            'Branch',
            'Booking ID',
          ],
          (n, size) => inTenant(actor, (tx) => invoicePage(tx, where, n, size)),
          (row) => [
            row.number,
            row.status,
            csvDateTime(row.issuedAt, timeZone),
            csvDateTime(row.paidAt, timeZone),
            csvAmount(row.amountCents),
            row.currency.toUpperCase(),
            row.booking.tenantCustomer.name,
            row.booking.serviceName,
            row.booking.branch.name,
            row.booking.id,
          ],
        ),
      };
    },

    invoice: (actor: Viewer, id: string): Promise<ConsoleInvoiceDetail> =>
      inTenant(actor, async (tx) => {
        const row = await tx.invoice.findUnique({
          where: { id },
          include: {
            payments: { orderBy: { createdAt: 'desc' } },
            booking: {
              include: {
                branch: { select: { id: true, name: true } },
                tenantCustomer: true,
                staff: { include: { teamAccount: { select: { name: true } } } },
              },
            },
          },
        });
        const branch = branchOf(actor);
        if (!row || (branch && row.booking.branchId !== branch)) throw notFound('Invoice');
        const { booking } = row;
        return {
          ...toInvoice({
            ...row,
            booking: {
              id: booking.id,
              serviceName: booking.serviceName,
              branch: booking.branch,
              tenantCustomer: { id: booking.tenantCustomer.id, name: booking.tenantCustomer.name },
            },
          }),
          voidReason: row.voidReason,
          customer: {
            id: booking.tenantCustomer.id,
            name: booking.tenantCustomer.name,
            email: booking.tenantCustomer.email,
            phone: booking.tenantCustomer.phone,
          },
          booking: {
            id: booking.id,
            status: booking.status,
            startsAt: booking.startsAt.toISOString(),
            endsAt: booking.endsAt.toISOString(),
            therapist: displayName(booking.staff.teamAccount.name),
          },
          payments: row.payments.map((p) => ({
            id: p.id,
            provider: p.provider,
            status: p.status,
            amountCents: p.amountCents,
            createdAt: p.createdAt.toISOString(),
          })),
          timeZone,
        };
      }),
  };
}

export type ConsoleRecordsService = ReturnType<typeof createConsoleRecordsService>;
