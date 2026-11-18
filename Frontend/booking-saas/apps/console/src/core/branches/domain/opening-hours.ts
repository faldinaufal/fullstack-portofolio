// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { OpeningHours } from './branch';

export const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];
const SHORT = WEEKDAYS.map((day) => day.slice(0, 3));

/** The week as shown in the editor: Monday first, Sunday last. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

/** `HH:MM` in 15-minute steps, the same rule as the API. */
export const isWallTime = (value: string) => /^([01]\d|2[0-3]):(00|15|30|45)$/.test(value);

/** Problems in a week of opening hours, keyed by weekday; empty when valid. */
export function openingHoursProblems(hours: OpeningHours[]): Record<number, string> {
  const problems: Record<number, string> = {};
  for (const day of hours) {
    if (!isWallTime(day.opensAt) || !isWallTime(day.closesAt)) {
      problems[day.weekday] = 'Use HH:MM in 15-minute steps.';
    } else if (day.opensAt >= day.closesAt) {
      problems[day.weekday] = 'Closing time must be after opening time.';
    }
  }
  return problems;
}

/**
 * Compact summary for lists: consecutive days with the same hours are grouped.
 * "Mon–Fri 09:00–18:00 · Sat 10:00–14:00"; "Closed all week" when empty.
 */
export function summarizeOpeningHours(hours: OpeningHours[]): string {
  const byDay = new Map(hours.map((h) => [h.weekday, `${h.opensAt}–${h.closesAt}`]));
  const groups: { from: number; to: number; time: string }[] = [];
  for (const day of WEEK_ORDER) {
    const time = byDay.get(day);
    const last = groups.at(-1);
    if (!time) continue;
    const previousDay = last ? WEEK_ORDER[WEEK_ORDER.indexOf(day) - 1] : undefined;
    if (last && last.time === time && last.to === previousDay) last.to = day;
    else groups.push({ from: day, to: day, time });
  }
  if (groups.length === 0) return 'Closed all week';
  return groups
    .map((g) => `${g.from === g.to ? SHORT[g.from] : `${SHORT[g.from]}–${SHORT[g.to]}`} ${g.time}`)
    .join(' · ');
}
