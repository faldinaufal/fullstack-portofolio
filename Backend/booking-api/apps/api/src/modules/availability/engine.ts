// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { TZDate } from '@date-fns/tz';

/**
 * Slot calculation (FSD 6.2), as a pure function: no database, no clock. The service layer
 * loads the inputs; this file only applies the rules, so each rule is unit-tested, including
 * daylight-saving transitions of the platform time zone.
 */

/** Start times are on the hour and half hour (FSD 6.1, platform constant). */
export const SLOT_INTERVAL_MINUTES = 30;

export interface WallInterval {
  /** `HH:MM` wall-clock time in the platform time zone. */
  start: string;
  end: string;
}

export interface Instant {
  start: Date;
  end: Date;
}

export interface AvailabilityInput {
  /** Calendar date `YYYY-MM-DD` in the platform time zone. */
  date: string;
  timeZone: string;
  now: Date;
  settings: { minLeadHours: number; maxAdvanceDays: number };
  service: { durationMinutes: number; bufferMinutes: number };
  /** The branch's opening hours on that weekday, or null when closed. */
  opening: WallInterval | null;
  /** The therapist's working hours on that weekday, or null when not working. */
  working: WallInterval | null;
  /** The branch has a closure covering the date. */
  closed: boolean;
  /** The therapist's time off. */
  timeOff: Instant[];
  /**
   * Blocked ranges (session + buffer) of the therapist's active bookings: `confirmed`, or
   * `pending_payment` with a hold that has not expired (FSD 6.2 rule 5).
   */
  bookings: Instant[];
}

/** Why a start time cannot be booked (FSD 6.13 codes). */
export type SlotProblem =
  | 'BRANCH_CLOSED'
  | 'OUTSIDE_OPENING_HOURS'
  | 'OUTSIDE_WORKING_HOURS'
  | 'OFF_GRID'
  | 'TOO_SOON'
  | 'TOO_FAR_AHEAD'
  | 'THERAPIST_TIME_OFF'
  | 'SLOT_TAKEN';

export interface Slot {
  startsAt: Date;
  /** End of the session (without the buffer), as shown to the customer. */
  endsAt: Date;
}

const toMinutes = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

/** Weekday (0 = Sunday) of a calendar date; independent of any time zone. */
export function weekdayOf(date: string): number {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

/** Today's calendar date in the time zone, `YYYY-MM-DD`. */
export function todayIn(timeZone: string, now: Date): string {
  const local = new TZDate(now, timeZone);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${local.getFullYear()}-${pad(local.getMonth() + 1)}-${pad(local.getDate())}`;
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * The instant at which the wall clock in `timeZone` shows `date` + `minutes`, or null when
 * that wall time does not exist (the hour skipped when clocks go forward). On the night
 * clocks go back, the earlier of the two instants is used.
 */
export function wallTimeToInstant(date: string, minutes: number, timeZone: string): Date | null {
  const [y, mo, d] = date.split('-').map(Number);
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const instant = new TZDate(y!, mo! - 1, d!, hour, minute, timeZone);
  // A non-existent wall time is shifted by the library; detect it by reading it back.
  if (instant.getHours() !== hour || instant.getMinutes() !== minute || instant.getDate() !== d) {
    return null;
  }
  return new Date(instant.getTime());
}

const overlaps = (a: Instant, b: Instant) => a.start < b.end && b.start < a.end;

/** Calendar date `YYYY-MM-DD` of an instant in the time zone. */
export function calendarDateOf(instant: Date, timeZone: string): string {
  return localParts(instant, timeZone).date;
}

/** Wall-clock date and minute of day of an instant in the time zone. */
function localParts(instant: Date, timeZone: string) {
  const local = new TZDate(instant, timeZone);
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    date: `${local.getFullYear()}-${pad(local.getMonth() + 1)}-${pad(local.getDate())}`,
    minute: local.getHours() * 60 + local.getMinutes(),
    onTheMinute: local.getSeconds() === 0 && local.getMilliseconds() === 0,
  };
}

/**
 * Why `start` cannot be booked, or null when it can (FSD 6.2). `input.date` must be the
 * start's calendar date in the platform zone. Checked in the order the rules are listed,
 * so the customer sees the most fundamental reason first:
 * 1. the branch is closed that day (closure, or no opening hours that weekday);
 * 2. on the 30-minute grid, at least `minLeadHours` ahead, within `maxAdvanceDays`;
 * 3. the session [S, S + duration) lies within the opening hours;
 * 4. ...and within the therapist's working hours (the buffer may extend past closing);
 * 5. the blocked range [S, S + duration + buffer) overlaps no time off and no active booking.
 * Rule 1's tenant, branch, service and therapist checks happen before, in the service layer.
 */
export function slotProblem(input: AvailabilityInput, start: Date): SlotProblem | null {
  const { timeZone, now, settings, service, opening, working } = input;
  if (input.closed) return 'BRANCH_CLOSED';
  if (!opening) return 'OUTSIDE_OPENING_HOURS';

  const local = localParts(start, timeZone);
  if (local.date !== input.date) return 'OFF_GRID';
  if (!local.onTheMinute || local.minute % SLOT_INTERVAL_MINUTES !== 0) return 'OFF_GRID';

  const today = todayIn(timeZone, now);
  const earliest = now.getTime() + settings.minLeadHours * 60 * 60_000;
  if (input.date < today || start.getTime() < earliest) return 'TOO_SOON';
  if (input.date > addDays(today, settings.maxAdvanceDays)) return 'TOO_FAR_AHEAD';

  const sessionEnd = local.minute + service.durationMinutes;
  if (local.minute < toMinutes(opening.start) || sessionEnd > toMinutes(opening.end)) {
    return 'OUTSIDE_OPENING_HOURS';
  }
  if (!working || local.minute < toMinutes(working.start) || sessionEnd > toMinutes(working.end)) {
    return 'OUTSIDE_WORKING_HOURS';
  }

  const end = start.getTime() + (service.durationMinutes + service.bufferMinutes) * 60_000;
  const blocked = { start, end: new Date(end) };
  if (input.timeOff.some((range) => overlaps(blocked, range))) return 'THERAPIST_TIME_OFF';
  if (input.bookings.some((range) => overlaps(blocked, range))) return 'SLOT_TAKEN';
  return null;
}

/**
 * Bookable start times for one therapist, service and day: every 30-minute start inside the
 * opening and working hours for which `slotProblem` finds nothing. Using the same function
 * for listing and for booking guarantees both apply exactly the same rules.
 */
export function availableSlots(input: AvailabilityInput): Slot[] {
  const { date, timeZone, opening, working, service } = input;
  if (input.closed || !opening || !working) return [];

  const windowStart = Math.max(toMinutes(opening.start), toMinutes(working.start));
  const windowEnd = Math.min(toMinutes(opening.end), toMinutes(working.end));
  const firstStart = Math.ceil(windowStart / SLOT_INTERVAL_MINUTES) * SLOT_INTERVAL_MINUTES;

  const slots: Slot[] = [];
  for (
    let minute = firstStart;
    minute + service.durationMinutes <= windowEnd;
    minute += SLOT_INTERVAL_MINUTES
  ) {
    const start = wallTimeToInstant(date, minute, timeZone);
    if (!start || slotProblem(input, start) !== null) continue;
    slots.push({
      startsAt: start,
      endsAt: new Date(start.getTime() + service.durationMinutes * 60_000),
    });
  }
  return slots;
}
