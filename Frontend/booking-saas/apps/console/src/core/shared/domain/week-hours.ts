// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

/** One interval on a weekday, `HH:MM` wall-clock times (0 = Sunday). */
export interface DayInterval {
  weekday: number;
  start: string;
  end: string;
}

/** `HH:MM` in 15-minute steps, the same rule as the API. */
export const isWallTime = (value: string) => /^([01]\d|2[0-3]):(00|15|30|45)$/.test(value);

/** Problems in a week of intervals, keyed by weekday; empty when valid. */
export function weekHoursProblems(
  days: DayInterval[],
  orderMessage = 'The end must be after the start.',
): Record<number, string> {
  const problems: Record<number, string> = {};
  for (const day of days) {
    if (!isWallTime(day.start) || !isWallTime(day.end)) {
      problems[day.weekday] = 'Use HH:MM in 15-minute steps.';
    } else if (day.start >= day.end) {
      problems[day.weekday] = orderMessage;
    }
  }
  return problems;
}
