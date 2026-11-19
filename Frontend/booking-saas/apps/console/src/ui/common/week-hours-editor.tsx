// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import { useState } from 'react';

export interface DayHours {
  weekday: number;
  start: string;
  end: string;
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
/** Monday first, Sunday last. */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

interface DayDraft {
  open: boolean;
  start: string;
  end: string;
}

/**
 * Draft state for a week of hours: one optional interval per weekday. `hours` is what the
 * API expects (days switched off are left out).
 */
export function useWeekHours(saved: DayHours[], defaults = { start: '09:00', end: '17:00' }) {
  const [days, setDays] = useState<Record<number, DayDraft>>(() =>
    Object.fromEntries(
      WEEK_ORDER.map((weekday) => {
        const day = saved.find((h) => h.weekday === weekday);
        return [
          weekday,
          { open: !!day, start: day?.start ?? defaults.start, end: day?.end ?? defaults.end },
        ];
      }),
    ),
  );
  const hours: DayHours[] = WEEK_ORDER.filter((d) => days[d]?.open).map((weekday) => ({
    weekday,
    start: days[weekday]!.start,
    end: days[weekday]!.end,
  }));
  const set = (weekday: number, change: Partial<DayDraft>) =>
    setDays((current) => ({ ...current, [weekday]: { ...current[weekday]!, ...change } }));
  return { days, hours, set };
}

/**
 * Seven rows (Monday–Sunday): a switch per day and start/end times in 15-minute steps.
 * Errors are shown next to the day they belong to.
 */
export function WeekHoursEditor({
  legend,
  days,
  set,
  problems,
  disabled = false,
  closedLabel = 'Closed',
}: Readonly<{
  legend: string;
  days: Record<number, DayDraft>;
  set: (weekday: number, change: Partial<DayDraft>) => void;
  problems: Record<number, string>;
  disabled?: boolean;
  closedLabel?: string;
}>) {
  return (
    <fieldset disabled={disabled} className="m-0 flex flex-col gap-2 border-0 p-0">
      <legend className="sr-only">{legend}</legend>
      {WEEK_ORDER.map((weekday) => {
        const day = days[weekday]!;
        const name = WEEKDAYS[weekday]!;
        return (
          <div
            key={weekday}
            className="flex flex-wrap items-center gap-3 rounded-xl bg-surface-muted/50 px-3 py-2"
          >
            <label className="flex w-36 items-center gap-2.5 text-sm font-semibold">
              <input
                type="checkbox"
                checked={day.open}
                onChange={(e) => set(weekday, { open: e.target.checked })}
                className="size-5 accent-primary"
              />
              {name}
            </label>
            {day.open ? (
              <span className="flex items-center gap-2 text-sm">
                <input
                  type="time"
                  step={900}
                  aria-label={`${name} from`}
                  value={day.start}
                  onChange={(e) => set(weekday, { start: e.target.value })}
                  className="h-10 rounded-lg border border-border bg-surface px-2"
                />
                –
                <input
                  type="time"
                  step={900}
                  aria-label={`${name} until`}
                  value={day.end}
                  onChange={(e) => set(weekday, { end: e.target.value })}
                  className="h-10 rounded-lg border border-border bg-surface px-2"
                />
              </span>
            ) : (
              <span className="text-sm text-muted">{closedLabel}</span>
            )}
            {problems[weekday] && (
              <span role="alert" className="w-full text-[13px] font-semibold text-danger">
                {problems[weekday]}
              </span>
            )}
          </div>
        );
      })}
    </fieldset>
  );
}
