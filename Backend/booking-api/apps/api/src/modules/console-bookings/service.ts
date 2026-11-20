// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type {
  Availability,
  Calendar,
  CalendarQuery,
  ConsoleBookingDetail,
  ConsoleBookingList,
  ConsoleBookingListQuery,
  ReassignRequest,
  TeamCancelRequest,
  TeamRescheduleRequest,
  TeamSlotsQuery,
} from '@tempora/contracts';
import { withDbContext, type Prisma, type PrismaClient, type Tx } from '@tempora/db';
import { AppError } from '../../lib/app-error.js';
import { recordAudit } from '../../lib/audit.js';
import type { PaymentProvider } from '../../lib/payments/provider.js';
import type { TokenHasher } from '../../lib/tokens.js';
import { csvAmount, csvDateTime, csvStream } from '../../lib/csv.js';
import { availableSlots, wallTimeToInstant } from '../availability/engine.js';
import { loadAvailabilityInput } from '../availability/load.js';
import { cancelBooking, closeCheckouts } from '../bookings/cancel.js';
import { moveBooking } from '../bookings/move.js';
import { translateOverlap } from '../bookings/rules.js';
import { auditActor } from '../branches/service.js';
import { notFound, viewerContext, type Viewer } from '../console-auth/access.js';
import type { ConsoleActor } from '../console-auth/guard.js';
import {
  bookingActions,
  canManageBooking,
  canSeeBooking,
  canSeeCustomerContact,
  effectiveStatus,
} from './access.js';
import {
  auditExport,
  BOOKING_ROW_INCLUDE,
  dateRange,
  exportFileName,
  toConsoleBooking,
  type BookingRow,
} from './rows.js';

const DAY = 24 * 60 * 60_000;
const NO_ACTIONS = {
  reschedule: false,
  reassign: false,
  cancel: false,
  cancelNeedsReason: false,
  complete: false,
  noShow: false,
};
/** The calendar shows at most two weeks at a time. */
const CALENDAR_MAX_DAYS = 14;

export interface ConsoleBookingDeps {
  prisma: PrismaClient;
  payments: PaymentProvider;
  hashToken: TokenHasher;
  portalUrl: string;
  timeZone: string;
  now?: () => Date;
}

/** Bookings in the Console: table, detail, calendar and the team's actions (FSD 2.2, 3.7, 3.8). */
export function createConsoleBookingService({
  prisma,
  payments,
  hashToken,
  portalUrl,
  timeZone,
  now = () => new Date(),
}: ConsoleBookingDeps) {
  const emails = { hashToken, portalUrl, timeZone };
  const inTenant = <T>(viewer: Viewer, work: (tx: Tx) => Promise<T>) =>
    withDbContext(prisma, viewerContext(viewer), work, { timeoutMs: 15_000 });

  /** Instant of midnight starting a calendar date in the platform time zone. */
  const startOf = (date: string) =>
    wallTimeToInstant(date, 0, timeZone) ?? new Date(`${date}T00:00:00Z`);
  const nextDate = (date: string) =>
    new Date(new Date(`${date}T12:00:00Z`).getTime() + DAY).toISOString().slice(0, 10);

  const toRow = (row: BookingRow, actor: Viewer) => toConsoleBooking(row, actor, now());

  /** A booking the actor may see, else `404` (outside scope = does not exist, FSD 1.3). */
  async function visible(tx: Tx, actor: Viewer, id: string) {
    const row = await tx.booking.findUnique({ where: { id }, include: BOOKING_ROW_INCLUDE });
    if (!row || !canSeeBooking(actor, row)) throw notFound('Booking');
    return row;
  }

  async function manageable(tx: Tx, actor: ConsoleActor, id: string) {
    const row = await visible(tx, actor, id);
    if (!canManageBooking(actor, row)) throw notFound('Booking');
    return row;
  }

  async function detail(tx: Tx, actor: Viewer, id: string): Promise<ConsoleBookingDetail> {
    const row = await visible(tx, actor, id);
    const contact = canSeeCustomerContact(actor);
    // Support views are read only: no actions, and the tenant's log stays the owner's.
    const support = Boolean(actor.supportGrantId);
    const timeline =
      contact && !support
        ? await tx.auditLog.findMany({
            where: { entityType: 'booking', entityId: id },
            orderBy: { createdAt: 'asc' },
          })
        : [];
    return {
      ...toRow(row, actor),
      customer: {
        id: row.tenantCustomer.id,
        name: row.tenantCustomer.name,
        email: contact ? row.tenantCustomer.email : null,
        phone: contact ? row.tenantCustomer.phone : null,
      },
      notes: row.customerNotes,
      durationMinutes: row.durationMinutes,
      bufferMinutes: row.bufferMinutes,
      serviceId: row.serviceId,
      holdExpiresAt:
        effectiveStatus(row, now()) === 'pending_payment'
          ? (row.holdExpiresAt?.toISOString() ?? null)
          : null,
      cancelReason: row.cancelReason,
      refundHandledExternally: row.refundHandledExternally,
      markedAt: row.markedAt?.toISOString() ?? null,
      customerRescheduleCount: row.customerRescheduleCount,
      timeZone,
      actions: support ? NO_ACTIONS : bookingActions(actor, row, now()),
      timeline: timeline.map((entry) => ({
        at: entry.createdAt.toISOString(),
        actor: entry.actorLabel,
        action: entry.action,
        reason: entry.reason,
        before: entry.before,
        after: entry.after,
      })),
    };
  }

  const notMovable = () =>
    new AppError({
      status: 409,
      code: 'NOT_RESCHEDULABLE',
      title: 'Booking cannot be moved',
      detail: 'Only upcoming bookings that are confirmed or waiting for payment can be moved.',
    });

  /** The team moves a booking: no customer limit, no lead time, until it starts (FSD 6.5, 6.6). */
  async function move(
    actor: ConsoleActor,
    id: string,
    target: { startsAt?: Date; staffId?: string },
    action: 'booking.rescheduled' | 'booking.reassigned',
  ) {
    await translateOverlap(() =>
      inTenant(actor, async (tx) => {
        const row = await manageable(tx, actor, id);
        await moveBooking(
          tx,
          id,
          { startsAt: target.startsAt ?? row.startsAt, staffId: target.staffId },
          {
            timeZone,
            now: now(),
            emails,
            byCustomer: false,
            action,
            actor: auditActor(actor),
            check: (booking) => {
              if (!bookingActions(actor, booking, now()).reschedule) throw notMovable();
            },
          },
        );
      }),
    );
    return inTenant(actor, (tx) => detail(tx, actor, id));
  }

  async function mark(actor: ConsoleActor, id: string, to: 'completed' | 'no_show') {
    return inTenant(actor, async (tx) => {
      const row = await visible(tx, actor, id);
      const actions = bookingActions(actor, row, now());
      if (!(to === 'completed' ? actions.complete : actions.noShow)) {
        throw new AppError({
          status: 409,
          code: 'NOT_MARKABLE',
          title: 'Cannot mark this booking',
          detail:
            'A session can be marked once it has started, until 7 days after it ended. Only the owner or manager can correct a mark.',
        });
      }
      const { count } = await tx.booking.updateMany({
        where: { id, status: row.status, version: row.version },
        data: {
          status: to,
          markedAt: now(),
          markedByMembershipId: actor.membershipId,
          version: { increment: 1 },
        },
      });
      if (count === 0) throw notFound('Booking');
      await recordAudit(tx, auditActor(actor), {
        tenantId: actor.tenantId,
        branchId: row.branchId,
        action: to === 'completed' ? 'booking.completed' : 'booking.no_show',
        entityType: 'booking',
        entityId: id,
        before: { status: row.status },
        after: { status: to },
      });
      return detail(tx, actor, id);
    });
  }

  /** Owner: every branch. Manager: their branch only, whatever the filter says. */
  function listWhere(
    actor: Viewer,
    query: Omit<ConsoleBookingListQuery, 'format'>,
  ): Prisma.BookingWhereInput {
    const startsAt = dateRange(timeZone, query.from, query.to);
    return {
      ...(actor.role === 'manager'
        ? { branchId: actor.branchId! }
        : query.branchId && { branchId: query.branchId }),
      ...(query.status && { status: query.status }),
      ...(query.staffId && { staffMembershipId: query.staffId }),
      ...(query.serviceId && { serviceId: query.serviceId }),
      ...(startsAt && { startsAt }),
      ...(query.q && {
        tenantCustomer: {
          OR: [
            { name: { contains: query.q, mode: 'insensitive' } },
            { email: { contains: query.q.toLowerCase() } },
          ],
        },
      }),
    };
  }

  const page = (
    tx: Tx,
    where: Prisma.BookingWhereInput,
    query: Pick<ConsoleBookingListQuery, 'sort'>,
    n: number,
    size: number,
  ) =>
    tx.booking.findMany({
      where,
      include: BOOKING_ROW_INCLUDE,
      orderBy: [{ startsAt: query.sort === '-startsAt' ? 'desc' : 'asc' }, { id: 'asc' }],
      skip: (n - 1) * size,
      take: size,
    });

  const filtersOf = ({ page: _p, pageSize: _s, format: _f, ...filters }: ConsoleBookingListQuery) =>
    filters;

  return {
    list: (
      actor: Viewer,
      query: Omit<ConsoleBookingListQuery, 'format'>,
    ): Promise<ConsoleBookingList> =>
      inTenant(actor, async (tx) => {
        const where = listWhere(actor, query);
        const total = await tx.booking.count({ where });
        const rows = await page(tx, where, query, query.page, query.pageSize);
        return {
          items: rows.map((row) => toRow(row, actor)),
          page: query.page,
          pageSize: query.pageSize,
          total,
          timeZone,
        };
      }),

    /** `?format=csv`: every page with the same filters and scope, audited (FSD 5.1). */
    async exportCsv(actor: ConsoleActor, query: ConsoleBookingListQuery) {
      const where = listWhere(actor, query);
      await inTenant(actor, async (tx) =>
        auditExport(tx, actor, 'bookings', filtersOf(query), await tx.booking.count({ where })),
      );
      return {
        fileName: exportFileName('bookings', now()),
        stream: csvStream(
          [
            'Booking ID',
            'Starts',
            'Ends',
            'Status',
            'Service',
            'Therapist',
            'Branch',
            'Customer',
            'Email',
            'Phone',
            'Price',
            'Invoice',
            'Invoice status',
          ],
          (n, size) => inTenant(actor, (tx) => page(tx, where, query, n, size)),
          (row) => [
            row.id,
            csvDateTime(row.startsAt, timeZone),
            csvDateTime(row.endsAt, timeZone),
            effectiveStatus(row, now()),
            row.serviceName,
            row.staff.teamAccount.name,
            row.branch.name,
            row.tenantCustomer.name,
            row.tenantCustomer.email,
            row.tenantCustomer.phone,
            csvAmount(row.priceCents),
            row.invoice?.number,
            row.invoice?.status,
          ],
        ),
      };
    },

    detail: (actor: Viewer, id: string) => inTenant(actor, (tx) => detail(tx, actor, id)),

    /** Day and week view of one branch (FSD 2.2 Calendar); staff see only their own column. */
    calendar: (actor: ConsoleActor, query: CalendarQuery): Promise<Calendar> =>
      inTenant(actor, async (tx) => {
        const from = startOf(query.from);
        const to = startOf(nextDate(query.to));
        const days = (to.getTime() - from.getTime()) / DAY;
        if (days <= 0 || days > CALENDAR_MAX_DAYS + 1) {
          throw new AppError({
            status: 400,
            code: 'VALIDATION_FAILED',
            title: 'Invalid range',
            detail: `Choose up to ${CALENDAR_MAX_DAYS} days, ending on or after the first day.`,
            errors: [{ path: 'to', message: 'Range too long or reversed.' }],
          });
        }
        const branchId = actor.role === 'owner' ? query.branchId : actor.branchId;
        if (actor.role !== 'owner' && query.branchId && query.branchId !== actor.branchId) {
          throw notFound('Branch');
        }
        const branch = await tx.branch.findFirst({
          where: { archivedAt: null, ...(branchId && { id: branchId }) },
          orderBy: { name: 'asc' },
        });
        if (!branch) throw notFound('Branch');

        const members = await tx.membership.findMany({
          where: {
            branchId: branch.id,
            status: 'active',
            ...(actor.role === 'staff' && { id: actor.membershipId }),
          },
          include: { teamAccount: { select: { name: true } } },
        });
        const ids = members.map((m) => m.id);
        const at = now();
        const bookings = await tx.booking.findMany({
          where: {
            branchId: branch.id,
            staffMembershipId: { in: ids },
            startsAt: { lt: to },
            endsAt: { gt: from },
            OR: [
              { status: { in: ['confirmed', 'completed', 'no_show'] } },
              { status: 'pending_payment', holdExpiresAt: { gt: at } },
            ],
          },
          include: { tenantCustomer: { select: { name: true } } },
          orderBy: { startsAt: 'asc' },
        });
        const timeOff = await tx.staffTimeOff.findMany({
          where: { membershipId: { in: ids }, startsAt: { lt: to }, endsAt: { gt: from } },
          orderBy: { startsAt: 'asc' },
        });
        return {
          timeZone,
          branch: { id: branch.id, name: branch.name },
          therapists: members
            .map((m) => ({ id: m.id, name: m.teamAccount.name }))
            .sort((a, b) => a.name.localeCompare(b.name)),
          bookings: bookings.map((b) => ({
            id: b.id,
            status: b.status,
            startsAt: b.startsAt.toISOString(),
            endsAt: b.endsAt.toISOString(),
            blockedUntil: b.blockedUntil.toISOString(),
            staffId: b.staffMembershipId,
            serviceName: b.serviceName,
            customerName: b.tenantCustomer.name,
            notes: b.customerNotes,
          })),
          timeOff: timeOff.map((t) => ({
            id: t.id,
            staffId: t.membershipId,
            startsAt: t.startsAt.toISOString(),
            endsAt: t.endsAt.toISOString(),
            reason: t.reason,
          })),
        };
      }),

    /** Free times for the team's reschedule and reassign dialog (own time not counted). */
    slots: (actor: ConsoleActor, id: string, query: TeamSlotsQuery): Promise<Availability> =>
      inTenant(actor, async (tx) => {
        const row = await manageable(tx, actor, id);
        const tenant = await tx.tenant.findUniqueOrThrow({ where: { id: actor.tenantId } });
        const { input } = await loadAvailabilityInput(
          tx,
          {
            branchId: row.branchId,
            serviceId: row.serviceId,
            staffId: query.staffId,
            date: query.date,
            excludeBookingId: row.id,
          },
          {
            timeZone,
            now: now(),
            settings: { minLeadHours: 0, maxAdvanceDays: tenant.maxAdvanceDays },
          },
        );
        const slots = availableSlots({
          ...input,
          service: { durationMinutes: row.durationMinutes, bufferMinutes: row.bufferMinutes },
        });
        return {
          date: query.date,
          timeZone,
          slots: slots.map((s) => ({
            startsAt: s.startsAt.toISOString(),
            endsAt: s.endsAt.toISOString(),
          })),
        };
      }),

    reschedule: (actor: ConsoleActor, id: string, input: TeamRescheduleRequest) =>
      move(
        actor,
        id,
        { startsAt: new Date(input.startsAt), ...(input.staffId && { staffId: input.staffId }) },
        'booking.rescheduled',
      ),

    reassign: (actor: ConsoleActor, id: string, input: ReassignRequest) =>
      move(actor, id, { staffId: input.staffId }, 'booking.reassigned'),

    /** FSD 6.7: unpaid or paid (reason required); the customer is emailed. */
    async cancel(actor: ConsoleActor, id: string, input: TeamCancelRequest) {
      const { sessions } = await inTenant(actor, async (tx) => {
        await manageable(tx, actor, id);
        return cancelBooking(tx, id, {
          now: now(),
          actor: auditActor(actor),
          by: { type: actor.role === 'owner' ? 'owner' : 'manager', id: actor.membershipId },
          allowPaid: true,
          reason: input.reason,
          notify: emails,
        });
      });
      await closeCheckouts(payments, sessions);
      return inTenant(actor, (tx) => detail(tx, actor, id));
    },

    complete: (actor: ConsoleActor, id: string) => mark(actor, id, 'completed'),
    noShow: (actor: ConsoleActor, id: string) => mark(actor, id, 'no_show'),
  };
}

export type ConsoleBookingService = ReturnType<typeof createConsoleBookingService>;
