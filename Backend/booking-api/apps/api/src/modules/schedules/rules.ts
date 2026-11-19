// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

/** Pure schedule rules, unit-tested without a database. Times are `HH:MM` wall-clock strings. */

export interface DayInterval {
  weekday: number;
  start: string;
  end: string;
}

/**
 * Working hours must lie within the branch's opening hours on the same weekday
 * (FSD 4.3 `staff_working_hours`). Returns the indexes of the entries that do not.
 * `HH:MM` strings compare correctly as text.
 */
export function hoursOutsideOpening(working: DayInterval[], opening: DayInterval[]): number[] {
  const openByDay = new Map(opening.map((day) => [day.weekday, day]));
  return working.flatMap((day, index) => {
    const open = openByDay.get(day.weekday);
    return open && open.start <= day.start && day.end <= open.end ? [] : [index];
  });
}

export const MAX_TIME_OFF_DAYS = 90;

/** Time off must end in the future and last at most 90 days. Null when valid. */
export function timeOffProblem(startsAt: Date, endsAt: Date, now: Date): string | null {
  if (endsAt <= now) return 'Time off must end in the future.';
  if (endsAt.getTime() - startsAt.getTime() > MAX_TIME_OFF_DAYS * 24 * 60 * 60_000) {
    return `Time off can last at most ${MAX_TIME_OFF_DAYS} days; add several entries for longer leave.`;
  }
  return null;
}
