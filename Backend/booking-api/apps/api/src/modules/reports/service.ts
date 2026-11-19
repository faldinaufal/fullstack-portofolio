// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type {
  NoShowReport,
  ReportOverview,
  ReportQuery,
  RevenueReport,
  SeriesQuery,
  ServiceReport,
  UtilizationReport,
} from '@tempora/contracts';
import { Prisma, withDbContext, type PrismaClient, type Tx } from '@tempora/db';
import { todayIn } from '../availability/engine.js';
import { toDateOnly, toWallTime } from '../branches/service.js';
import { notFound } from '../console-auth/access.js';
import type { ConsoleActor } from '../console-auth/guard.js';
import {
  addDays,
  availableMinutes,
  bucketStarts,
  DEFAULT_RANGE_DAYS,
  fillBuckets,
  rangeInstants,
  ratio,
  resolveRange,
} from './calc.js';

/** Bookings that took or will take place (FSD 6.14): not holds, not expired or cancelled. */
const REAL = Prisma.sql`b.status IN ('confirmed', 'completed', 'no_show')`;

const dateKey = (value: Date) => value.toISOString().slice(0, 10);

export interface ReportServiceDeps {
  prisma: PrismaClient;
  timeZone: string;
  now?: () => Date;
}

/** Dashboard reports (FSD 5.4, 6.14): owner (any branch or all) and manager (own branch). */
export function createReportService({
  prisma,
  timeZone,
  now = () => new Date(),
}: ReportServiceDeps) {
  const inTenant = <T>(actor: ConsoleActor, work: (tx: Tx) => Promise<T>) =>
    withDbContext(prisma, { tenantId: actor.tenantId, teamAccountId: actor.teamAccountId }, work, {
      timeoutMs: 15_000,
    });

  /** A manager always gets their branch; an owner the one asked for (it must exist), or all. */
  async function scopeOf(tx: Tx, actor: ConsoleActor, branchId: string | undefined) {
    const branch = actor.role === 'manager' ? actor.branchId! : branchId;
    if (branch && !(await tx.branch.findFirst({ where: { id: branch } }))) throw notFound('Branch');
    return branch ?? null;
  }

  const inBranch = (branch: string | null) =>
    branch ? Prisma.sql`AND b.branch_id = ${branch}::uuid` : Prisma.empty;

  /** Revenue (FSD 6.14): paid invoices by the day they were paid, without refunded bookings. */
  async function revenue(
    tx: Tx,
    branch: string | null,
    range: { from: string; to: string },
    interval: SeriesQuery['interval'],
  ) {
    const { start, end } = rangeInstants(range, timeZone);
    const rows = await tx.$queryRaw<{ start: Date; cents: bigint }[]>`
      SELECT date_trunc(${interval}, i.paid_at AT TIME ZONE ${timeZone})::date AS start,
             sum(i.amount_cents)::bigint AS cents
      FROM invoices i JOIN bookings b ON b.id = i.booking_id
      WHERE i.status = 'paid' AND NOT b.refund_handled_externally
        AND i.paid_at >= ${start} AND i.paid_at < ${end} ${inBranch(branch)}
      GROUP BY 1`;
    return rows.map((r) => ({ start: dateKey(r.start), cents: Number(r.cents) }));
  }

  /** Booked minutes per therapist, and available minutes from their schedule (FSD 6.14). */
  async function utilization(tx: Tx, branch: string | null, range: { from: string; to: string }) {
    const { start, end } = rangeInstants(range, timeZone);
    const branches = await tx.branch.findMany({
      where: { archivedAt: null, ...(branch && { id: branch }) },
      include: { openingHours: true, closures: true },
      orderBy: { name: 'asc' },
    });
    const members = await tx.membership.findMany({
      where: { status: 'active', branchId: { in: branches.map((b) => b.id) } },
      include: {
        teamAccount: { select: { name: true } },
        workingHours: true,
        timeOff: { where: { startsAt: { lt: end }, endsAt: { gt: start } } },
      },
    });
    const booked = await tx.$queryRaw<{ staff_id: string; minutes: bigint }[]>`
      SELECT b.staff_membership_id AS staff_id, sum(b.duration_minutes)::bigint AS minutes
      FROM bookings b
      WHERE ${REAL} AND b.starts_at >= ${start} AND b.starts_at < ${end} ${inBranch(branch)}
      GROUP BY 1`;
    const bookedBy = new Map(booked.map((r) => [r.staff_id, Number(r.minutes)]));

    const therapists = members
      .map((m) => {
        const home = branches.find((b) => b.id === m.branchId)!;
        return {
          id: m.id,
          name: m.teamAccount.name,
          branchId: home.id,
          bookedMinutes: bookedBy.get(m.id) ?? 0,
          availableMinutes: availableMinutes({
            ...range,
            timeZone,
            working: m.workingHours.map((w) => ({
              weekday: w.weekday,
              start: toWallTime(w.startsAt),
              end: toWallTime(w.endsAt),
            })),
            opening: home.openingHours.map((o) => ({
              weekday: o.weekday,
              start: toWallTime(o.opensAt),
              end: toWallTime(o.closesAt),
            })),
            closures: home.closures.map((c) => ({
              startsOn: toDateOnly(c.startsOn),
              endsOn: toDateOnly(c.endsOn),
            })),
            timeOff: m.timeOff,
          }),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    return {
      branches: branches.map((b) => {
        const own = therapists.filter((t) => t.branchId === b.id);
        return {
          id: b.id,
          name: b.name,
          bookedMinutes: own.reduce((sum, t) => sum + t.bookedMinutes, 0),
          availableMinutes: own.reduce((sum, t) => sum + t.availableMinutes, 0),
        };
      }),
      therapists,
    };
  }

  /** Finished sessions (completed or no-show) and no-shows, per bucket of their start. */
  async function noShows(
    tx: Tx,
    branch: string | null,
    range: { from: string; to: string },
    interval: SeriesQuery['interval'],
  ) {
    const { start, end } = rangeInstants(range, timeZone);
    const rows = await tx.$queryRaw<{ start: Date; finished: number; no_shows: number }[]>`
      SELECT date_trunc(${interval}, b.starts_at AT TIME ZONE ${timeZone})::date AS start,
             count(*) FILTER (WHERE b.status IN ('completed', 'no_show'))::int AS finished,
             count(*) FILTER (WHERE b.status = 'no_show')::int AS no_shows
      FROM bookings b
      WHERE b.starts_at >= ${start} AND b.starts_at < ${end} ${inBranch(branch)}
      GROUP BY 1`;
    return rows.map((r) => ({
      start: dateKey(r.start),
      finished: r.finished,
      noShows: r.no_shows,
    }));
  }

  async function countBookingsOn(tx: Tx, branch: string | null, date: string) {
    const { start, end } = rangeInstants({ from: date, to: date }, timeZone);
    const [row] = await tx.$queryRaw<{ n: number }[]>`
      SELECT count(*)::int AS n FROM bookings b
      WHERE ${REAL} AND b.starts_at >= ${start} AND b.starts_at < ${end} ${inBranch(branch)}`;
    return row?.n ?? 0;
  }

  return {
    overview: (
      actor: ConsoleActor,
      query: Pick<ReportQuery, 'branchId'>,
    ): Promise<ReportOverview> =>
      inTenant(actor, async (tx) => {
        const branch = await scopeOf(tx, actor, query.branchId);
        const today = todayIn(timeZone, now());
        const monthStart = `${today.slice(0, 7)}-01`;
        const lastMonthStart = `${addDays(monthStart, -1).slice(0, 7)}-01`;
        const sum = (rows: { cents: number }[]) => rows.reduce((total, r) => total + r.cents, 0);
        const last30 = { from: addDays(today, -(DEFAULT_RANGE_DAYS - 1)), to: today };

        const use = await utilization(tx, branch, last30);
        const marks = await noShows(tx, branch, last30, 'month');
        const at = now();
        const [pending] = await tx.$queryRaw<{ n: number }[]>`
          SELECT count(*)::int AS n FROM bookings b
          WHERE b.status = 'pending_payment' AND b.hold_expires_at > ${at} ${inBranch(branch)}`;

        return {
          today,
          timeZone,
          bookingsToday: await countBookingsOn(tx, branch, today),
          bookingsSameDayLastWeek: await countBookingsOn(tx, branch, addDays(today, -7)),
          revenueThisMonthCents: sum(
            await revenue(tx, branch, { from: monthStart, to: today }, 'month'),
          ),
          revenueLastMonthCents: sum(
            await revenue(
              tx,
              branch,
              { from: lastMonthStart, to: addDays(monthStart, -1) },
              'month',
            ),
          ),
          utilization: ratio(
            use.branches.reduce((s, b) => s + b.bookedMinutes, 0),
            use.branches.reduce((s, b) => s + b.availableMinutes, 0),
          ),
          noShowRate: ratio(
            marks.reduce((s, m) => s + m.noShows, 0),
            marks.reduce((s, m) => s + m.finished, 0),
          ),
          paymentsPending: pending?.n ?? 0,
          activeTherapists: use.therapists.length,
          branches: use.branches.length,
        };
      }),

    revenue: (actor: ConsoleActor, query: SeriesQuery): Promise<RevenueReport> =>
      inTenant(actor, async (tx) => {
        const branch = await scopeOf(tx, actor, query.branchId);
        const range = resolveRange(query, timeZone, now());
        const rows = await revenue(tx, branch, range, query.interval);
        const buckets = fillBuckets(
          bucketStarts(range.from, range.to, query.interval),
          rows,
          (r) => ({
            cents: r?.cents ?? 0,
          }),
        );

        // The owner's comparison across branches (PRD: "all branches + comparison").
        let byBranch: RevenueReport['byBranch'] = [];
        if (actor.role === 'owner' && !branch) {
          const { start, end } = rangeInstants(range, timeZone);
          const rows = await tx.$queryRaw<{ id: string; name: string; cents: bigint }[]>`
            SELECT br.id, br.name, coalesce(sum(i.amount_cents), 0)::bigint AS cents
            FROM branches br
            LEFT JOIN bookings b ON b.branch_id = br.id AND NOT b.refund_handled_externally
            LEFT JOIN invoices i ON i.booking_id = b.id AND i.status = 'paid'
              AND i.paid_at >= ${start} AND i.paid_at < ${end}
            WHERE br.archived_at IS NULL
            GROUP BY br.id, br.name
            ORDER BY cents DESC, br.name`;
          byBranch = rows.map((r) => ({ id: r.id, name: r.name, cents: Number(r.cents) }));
        }
        return {
          ...range,
          timeZone,
          interval: query.interval,
          buckets,
          totalCents: buckets.reduce((total, b) => total + b.cents, 0),
          byBranch,
        };
      }),

    bookingsByService: (actor: ConsoleActor, query: ReportQuery): Promise<ServiceReport> =>
      inTenant(actor, async (tx) => {
        const branch = await scopeOf(tx, actor, query.branchId);
        const range = resolveRange(query, timeZone, now());
        const { start, end } = rangeInstants(range, timeZone);
        const rows = await tx.$queryRaw<
          { service_id: string; name: string; bookings: number; revenue: bigint }[]
        >`
          SELECT s.id AS service_id, s.name, count(*)::int AS bookings,
                 coalesce(sum(i.amount_cents) FILTER (
                   WHERE i.status = 'paid' AND NOT b.refund_handled_externally
                 ), 0)::bigint AS revenue
          FROM bookings b
          JOIN services s ON s.id = b.service_id
          LEFT JOIN invoices i ON i.booking_id = b.id
          WHERE ${REAL} AND b.starts_at >= ${start} AND b.starts_at < ${end} ${inBranch(branch)}
          GROUP BY s.id, s.name
          ORDER BY bookings DESC, s.name`;
        return {
          ...range,
          timeZone,
          items: rows.map((r) => ({
            serviceId: r.service_id,
            name: r.name,
            bookings: r.bookings,
            revenueCents: Number(r.revenue),
          })),
        };
      }),

    utilization: (actor: ConsoleActor, query: ReportQuery): Promise<UtilizationReport> =>
      inTenant(actor, async (tx) => {
        const branch = await scopeOf(tx, actor, query.branchId);
        const range = resolveRange(query, timeZone, now());
        return { ...range, timeZone, ...(await utilization(tx, branch, range)) };
      }),

    noShowRate: (actor: ConsoleActor, query: SeriesQuery): Promise<NoShowReport> =>
      inTenant(actor, async (tx) => {
        const branch = await scopeOf(tx, actor, query.branchId);
        const range = resolveRange(query, timeZone, now());
        const rows = await noShows(tx, branch, range, query.interval);
        return {
          ...range,
          timeZone,
          interval: query.interval,
          buckets: fillBuckets(bucketStarts(range.from, range.to, query.interval), rows, (r) => ({
            finished: r?.finished ?? 0,
            noShows: r?.noShows ?? 0,
          })),
        };
      }),
  };
}

export type ReportService = ReturnType<typeof createReportService>;
