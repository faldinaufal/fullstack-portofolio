// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type {
  Availability,
  Calendar,
  CalendarQuery,
  ConsoleBooking,
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
import { availableSlots, wallTimeToInstant } from '../availability/engine.js';
import { loadAvailabilityInput } from '../availability/load.js';
import { cancelBooking, closeCheckouts } from '../bookings/cancel.js';
import { moveBooking } from '../bookings/move.js';
import { translateOverlap } from '../bookings/rules.js';
import { auditActor } from '../branches/service.js';
import { notFound } from '../console-auth/access.js';
import type { ConsoleActor } from '../console-auth/guard.js';
import {
  bookingActions,
  canManageBooking,
  canSeeBooking,
  canSeeCustomerContact,
  effectiveStatus,
} from './access.js';

const DAY = 24 * 60 * 60_000;
/** The calendar shows at most two weeks at a time. */
const CALENDAR_MAX_DAYS = 14;

const INCLUDE = {
  branch: { select: { id: true, name: true } },
  staff: { include: { teamAccount: { select: { name: true } } } },
  tenantCustomer: true,
  invoice: { select: { number: true, status: true } },
} as const;

type Row = Prisma.BookingGetPayload<{ include: typeof INCLUDE }>;

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
  const inTenant = <T>(actor: ConsoleActor, work: (tx: Tx) => Promise<T>) =>
    withDbContext(prisma, { tenantId: actor.tenantId, teamAccountId: actor.teamAccountId }, work, {
      timeoutMs: 15_000,
    });

  /** Instant of midnight starting a calendar date in the platform time zone. */
  const startOf = (date: string) =>
    wallTimeToInstant(date, 0, timeZone) ?? new Date(`${date}T00:00:00Z`);
  const nextDate = (date: string) =>
    new Date(new Date(`${date}T12:00:00Z`).getTime() + DAY).toISOString().slice(0, 10);

  function toRow(row: Row, actor: ConsoleActor): ConsoleBooking {
    return {
      id: row.id,
      status: effectiveStatus(row, now()) as ConsoleBooking['status'],
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt.toISOString(),
      serviceName: row.serviceName,
      priceCents: row.priceCents,
      branch: row.branch,
      therapist: { id: row.staffMembershipId, name: row.staff.teamAccount.name },
      customer: {
        name: row.tenantCustomer.name,
        email: canSeeCustomerContact(actor) ? row.tenantCustomer.email : null,
      },
      invoice: { number: row.invoice?.number ?? '', status: row.invoice?.status ?? 'open' },
    };
  }

  /** A booking the actor may see, else `404` (outside scope = does not exist, FSD 1.3). */
  async function visible(tx: Tx, actor: ConsoleActor, id: string) {
    const row = await tx.booking.findUnique({ where: { id }, include: INCLUDE });
    if (!row || !canSeeBooking(actor, row)) throw notFound('Booking');
    return row;
  }

  async function manageable(tx: Tx, actor: ConsoleActor, id: string) {
    const row = await visible(tx, actor, id);
    if (!canManageBooking(actor, row)) throw notFound('Booking');
    return row;
  }

  async function detail(tx: Tx, actor: ConsoleActor, id: string): Promise<ConsoleBookingDetail> {
    const row = await visible(tx, actor, id);
    const contact = canSeeCustomerContact(actor);
    const timeline = contact
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
      actions: bookingActions(actor, row, now()),
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

  return {
    /** Owner: every branch. Manager: their branch only, whatever the filter says. */
    list: (actor: ConsoleActor, query: ConsoleBookingListQuery): Promise<ConsoleBookingList> =>
      inTenant(actor, async (tx) => {
        const where: Prisma.BookingWhereInput = {
          ...(actor.role === 'manager'
            ? { branchId: actor.branchId! }
            : query.branchId && { branchId: query.branchId }),
          ...(query.status && { status: query.status }),
          ...(query.staffId && { staffMembershipId: query.staffId }),
          ...(query.serviceId && { serviceId: query.serviceId }),
          ...((query.from || query.to) && {
            startsAt: {
              ...(query.from && { gte: startOf(query.from) }),
              ...(query.to && { lt: startOf(nextDate(query.to)) }),
            },
          }),
          ...(query.q && {
            tenantCustomer: {
              OR: [
                { name: { contains: query.q, mode: 'insensitive' } },
                { email: { contains: query.q.toLowerCase() } },
              ],
            },
          }),
        };
        const total = await tx.booking.count({ where });
        const rows = await tx.booking.findMany({
          where,
          include: INCLUDE,
          orderBy: [{ startsAt: query.sort === '-startsAt' ? 'desc' : 'asc' }, { id: 'asc' }],
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        });
        return {
          items: rows.map((row) => toRow(row, actor)),
          page: query.page,
          pageSize: query.pageSize,
          total,
          timeZone,
        };
      }),

    detail: (actor: ConsoleActor, id: string) => inTenant(actor, (tx) => detail(tx, actor, id)),

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
