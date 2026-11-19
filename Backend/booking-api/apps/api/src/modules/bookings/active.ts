// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { BookingConflict } from '@tempora/contracts';
import type { Prisma, Tx } from '@tempora/db';
import { AppError } from '../../lib/app-error.js';
import { calendarDateOf, weekdayOf } from '../availability/engine.js';
import { displayName } from '../public/service.js';

/**
 * "Active booking" for the blocking rules of FSD 6.8: still to come (not ended), and
 * confirmed or holding its slot for payment. These are the bookings a schedule change must
 * not strand, so the change is refused with the list until each is reassigned or cancelled.
 */
export const activeBookingWhere = (now: Date): Prisma.BookingWhereInput => ({
  endsAt: { gt: now },
  OR: [{ status: 'confirmed' }, { status: 'pending_payment', holdExpiresAt: { gt: now } }],
});

const CONFLICT_INCLUDE = {
  staff: { include: { teamAccount: { select: { name: true } } } },
  tenantCustomer: { select: { name: true } },
} as const;

/** Shown in the error; the full list is in the Console's bookings table. */
const MAX_CONFLICTS = 50;

export async function activeBookings(tx: Tx, where: Prisma.BookingWhereInput, now: Date) {
  return tx.booking.findMany({
    where: { AND: [where, activeBookingWhere(now)] },
    include: CONFLICT_INCLUDE,
    orderBy: { startsAt: 'asc' },
    take: MAX_CONFLICTS,
  });
}

type ActiveRow = Awaited<ReturnType<typeof activeBookings>>[number];

export const toConflict = (row: ActiveRow): BookingConflict => ({
  id: row.id,
  startsAt: row.startsAt.toISOString(),
  endsAt: row.endsAt.toISOString(),
  serviceName: row.serviceName,
  therapist: displayName(row.staff.teamAccount.name),
  customerName: row.tenantCustomer.name,
});

/** `409 HAS_ACTIVE_BOOKINGS` with the bookings that block the change (FSD 6.8, 6.13). */
export function assertNoConflicts(rows: ActiveRow[], detail: string): void {
  if (rows.length === 0) return;
  throw new AppError({
    status: 409,
    code: 'HAS_ACTIVE_BOOKINGS',
    title: 'Active bookings in the way',
    detail: `${detail} Reassign or cancel ${rows.length === 1 ? 'this booking' : `these ${rows.length} bookings`} first.`,
    conflicts: rows.map(toConflict),
  });
}

/** Minutes since midnight of an instant on the wall clock of a time zone. */
export function wallMinutes(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone,
  }).formatToParts(instant);
  const value = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return value('hour') * 60 + value('minute');
}

const toMinutes = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  return h! * 60 + m!;
};

export interface WeeklyHours {
  /** 0 = Sunday. */
  weekday: number;
  start: string;
  end: string;
}

/**
 * Bookings whose session `[start, end)` no longer lies within the given weekly hours (new
 * working or opening hours, FSD 6.8). As in rule 6.2, the buffer may run past closing time.
 */
export function outsideHours<T extends { startsAt: Date; endsAt: Date }>(
  bookings: T[],
  hours: WeeklyHours[],
  timeZone: string,
): T[] {
  return bookings.filter((booking) => {
    const day = hours.find(
      (h) => h.weekday === weekdayOf(calendarDateOf(booking.startsAt, timeZone)),
    );
    if (!day) return true;
    const start = wallMinutes(booking.startsAt, timeZone);
    const end = start + (booking.endsAt.getTime() - booking.startsAt.getTime()) / 60_000;
    return start < toMinutes(day.start) || end > toMinutes(day.end);
  });
}

/** Bookings on a calendar day (business time zone) within `[startsOn, endsOn]`. */
export function onDays<T extends { startsAt: Date }>(
  bookings: T[],
  startsOn: string,
  endsOn: string,
  timeZone: string,
): T[] {
  return bookings.filter((booking) => {
    const date = calendarDateOf(booking.startsAt, timeZone);
    return date >= startsOn && date <= endsOn;
  });
}
