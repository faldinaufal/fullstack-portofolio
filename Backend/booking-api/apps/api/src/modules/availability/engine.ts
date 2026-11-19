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
  /** Ranges the therapist is unavailable: time off, and (from FSD stage 5) active bookings. */
  busy: Instant[];
}

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

/**
 * Bookable start times for one therapist, service and day. A start time S is returned only if:
 * 1. the day is not a closure, and the branch is open and the therapist works that weekday;
 * 2. S is on the 30-minute grid, at least `minLeadHours` from now and on or before
 *    today + `maxAdvanceDays`;
 * 3–4. the session [S, S + duration) lies within both the opening and the working hours
 *    (the buffer may extend past closing time);
 * 5. the blocked range [S, S + duration + buffer) overlaps no busy range.
 * Rule 1's tenant, branch, service and therapist checks happen before, in the service layer.
 */
export function availableSlots(input: AvailabilityInput): Slot[] {
  const { date, timeZone, now, settings, service, opening, working } = input;
  if (input.closed || !opening || !working) return [];

  const today = todayIn(timeZone, now);
  if (date < today || date > addDays(today, settings.maxAdvanceDays)) return [];
  const earliest = new Date(now.getTime() + settings.minLeadHours * 60 * 60_000);

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
    if (!start || start < earliest) continue;
    const end = new Date(start.getTime() + service.durationMinutes * 60_000);
    const blocked = { start, end: new Date(end.getTime() + service.bufferMinutes * 60_000) };
    if (input.busy.some((range) => overlaps(blocked, range))) continue;
    slots.push({ startsAt: start, endsAt: end });
  }
  return slots;
}
