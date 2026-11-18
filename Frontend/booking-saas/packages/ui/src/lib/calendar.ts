// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

export interface CalendarDay {
  /** ISO date `YYYY-MM-DD`. */
  date: string;
  day: number;
  inMonth: boolean;
}

function iso(year: number, monthIndex: number, day: number): string {
  return new Date(Date.UTC(year, monthIndex, day)).toISOString().slice(0, 10);
}

/**
 * The weeks shown in a month view, Sunday first, padded with days of the previous and
 * next month so every week has 7 days. Uses UTC so the result never shifts with the
 * viewer's time zone.
 */
export function monthGrid(year: number, monthIndex: number): CalendarDay[][] {
  const firstWeekday = new Date(Date.UTC(year, monthIndex, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const cells: CalendarDay[] = [];

  for (let i = firstWeekday; i > 0; i--) {
    const date = new Date(Date.UTC(year, monthIndex, 1 - i));
    cells.push({ date: date.toISOString().slice(0, 10), day: date.getUTCDate(), inMonth: false });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ date: iso(year, monthIndex, day), day, inMonth: true });
  }
  let next = 1;
  while (cells.length % 7 !== 0) {
    cells.push({ date: iso(year, monthIndex + 1, next), day: next, inMonth: false });
    next++;
  }

  const weeks: CalendarDay[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}
