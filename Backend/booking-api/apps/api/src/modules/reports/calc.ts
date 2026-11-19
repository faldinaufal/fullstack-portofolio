// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { ReportInterval } from '@tempora/contracts';
import { AppError } from '../../lib/app-error.js';
import { todayIn, wallTimeToInstant, weekdayOf } from '../availability/engine.js';

/** Pure calculations behind the reports (FSD 6.14), unit-tested on their own. */

const DAY = 24 * 60 * 60_000;
export const MAX_RANGE_DAYS = 366;
export const DEFAULT_RANGE_DAYS = 30;

/** `YYYY-MM-DD` plus `days`. */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export const daysBetween = (from: string, to: string) =>
  Math.round(
    (new Date(`${to}T12:00:00Z`).getTime() - new Date(`${from}T12:00:00Z`).getTime()) / DAY,
  );

/** The report's dates: as asked, or the last 30 days up to today. At most 366 days. */
export function resolveRange(
  query: { from?: string | undefined; to?: string | undefined },
  timeZone: string,
  now: Date,
): { from: string; to: string } {
  const to = query.to ?? todayIn(timeZone, now);
  const from = query.from ?? addDays(to, -(DEFAULT_RANGE_DAYS - 1));
  const length = daysBetween(from, to) + 1;
  if (length < 1 || length > MAX_RANGE_DAYS) {
    throw new AppError({
      status: 400,
      code: 'VALIDATION_FAILED',
      title: 'Invalid range',
      detail: `Choose up to ${MAX_RANGE_DAYS} days, ending on or after the first day.`,
      errors: [{ path: 'to', message: 'Range too long or reversed.' }],
    });
  }
  return { from, to };
}

/** Instants from the start of `from` to the end of `to`, on the platform clock. */
export function rangeInstants(range: { from: string; to: string }, timeZone: string) {
  const start = (date: string) =>
    wallTimeToInstant(date, 0, timeZone) ?? new Date(`${date}T00:00:00Z`);
  return { start: start(range.from), end: start(addDays(range.to, 1)) };
}

/** First day of the bucket a date falls in: the day, Monday of its week, or the 1st. */
export function bucketOf(date: string, interval: ReportInterval): string {
  if (interval === 'day') return date;
  if (interval === 'month') return `${date.slice(0, 7)}-01`;
  const weekday = weekdayOf(date); // 0 = Sunday
  return addDays(date, -((weekday + 6) % 7));
}

/** Every bucket from the one holding `from` to the one holding `to`, oldest first. */
export function bucketStarts(from: string, to: string, interval: ReportInterval): string[] {
  const starts: string[] = [];
  let current = bucketOf(from, interval);
  while (current <= to) {
    starts.push(current);
    if (interval === 'day') current = addDays(current, 1);
    else if (interval === 'week') current = addDays(current, 7);
    else {
      const [y, m] = current.split('-').map(Number);
      current = m === 12 ? `${y! + 1}-01-01` : `${y}-${String(m! + 1).padStart(2, '0')}-01`;
    }
  }
  return starts;
}

/** Fills a sparse series so every bucket appears, with `pick(undefined)` where nothing happened. */
export function fillBuckets<R extends { start: string }, T>(
  starts: string[],
  rows: R[],
  pick: (row: R | undefined) => T,
): (T & { start: string })[] {
  const byStart = new Map(rows.map((row) => [row.start, row]));
  return starts.map((start) => ({ ...pick(byStart.get(start)), start }));
}

const toMinutes = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  return h! * 60 + m!;
};

export interface WeeklyWindow {
  weekday: number;
  start: string;
  end: string;
}

/**
 * Available minutes of one therapist (FSD 6.14 utilization): on each day of the range, their
 * working hours intersected with the branch's opening hours, minus closure days and minus
 * time off (overlapping time off is counted once). Wall-clock windows are turned into instants
 * in the platform time zone, so a daylight-saving day counts its real length.
 */
export function availableMinutes(input: {
  from: string;
  to: string;
  timeZone: string;
  working: WeeklyWindow[];
  opening: WeeklyWindow[];
  closures: { startsOn: string; endsOn: string }[];
  timeOff: { startsAt: Date; endsAt: Date }[];
}): number {
  let total = 0;
  for (let date = input.from; date <= input.to; date = addDays(date, 1)) {
    if (input.closures.some((c) => c.startsOn <= date && date <= c.endsOn)) continue;
    const weekday = weekdayOf(date);
    const work = input.working.find((w) => w.weekday === weekday);
    const open = input.opening.find((o) => o.weekday === weekday);
    if (!work || !open) continue;
    const startMin = Math.max(toMinutes(work.start), toMinutes(open.start));
    const endMin = Math.min(toMinutes(work.end), toMinutes(open.end));
    if (endMin <= startMin) continue;
    const start = wallTimeToInstant(date, startMin, input.timeZone);
    const end = wallTimeToInstant(date, endMin, input.timeZone);
    if (!start || !end) continue;

    // Time off inside this window, merged so overlapping entries are not subtracted twice.
    const cuts = input.timeOff
      .map(
        (t) =>
          [
            Math.max(t.startsAt.getTime(), start.getTime()),
            Math.min(t.endsAt.getTime(), end.getTime()),
          ] as const,
      )
      .filter(([a, b]) => b > a)
      .sort((x, y) => x[0] - y[0]);
    let off = 0;
    let reach = -Infinity;
    for (const [a, b] of cuts) {
      const from = Math.max(a, reach);
      if (b > from) off += b - from;
      reach = Math.max(reach, b);
    }
    total += (end.getTime() - start.getTime() - off) / 60_000;
  }
  return Math.round(total);
}

/** A share 0–1, or null when there is nothing to divide by. */
export const ratio = (part: number, whole: number) => (whole > 0 ? part / whole : null);
