import { monthGrid } from '../lib/calendar.js';
import { cn } from '../lib/cn.js';
import { Icon } from './icon.js';

export interface MonthCalendarProps {
  year: number;
  /** 0 = January. */
  monthIndex: number;
  /** ISO date highlighted as today. */
  today?: string;
  /** ISO dates marked with a ring (e.g. closures), with their accessible labels. */
  marked?: Record<string, string>;
  onPrevious?: () => void;
  onNext?: () => void;
  className?: string;
}

const WEEKDAYS = [
  ['Su', 'Sunday'],
  ['Mo', 'Monday'],
  ['Tu', 'Tuesday'],
  ['We', 'Wednesday'],
  ['Th', 'Thursday'],
  ['Fr', 'Friday'],
  ['Sa', 'Saturday'],
] as const;

/** Compact month view, as in the Console dashboard design. */
export function MonthCalendar({
  year,
  monthIndex,
  today,
  marked = {},
  onPrevious,
  onNext,
  className,
}: Readonly<MonthCalendarProps>) {
  const title = new Date(Date.UTC(year, monthIndex, 1)).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

  return (
    <div className={cn('flex flex-col gap-3.5', className)}>
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onPrevious}
          disabled={!onPrevious}
          aria-label="Previous month"
          className="flex size-9 items-center justify-center rounded-full bg-surface-muted disabled:opacity-50"
        >
          <Icon name="chevron-left" size={16} />
        </button>
        <p className="text-sm font-extrabold text-primary-text" aria-live="polite">
          {title}
        </p>
        <button
          type="button"
          onClick={onNext}
          disabled={!onNext}
          aria-label="Next month"
          className="flex size-9 items-center justify-center rounded-full bg-surface-muted disabled:opacity-50"
        >
          <Icon name="chevron-right" size={16} />
        </button>
      </div>
      <table className="w-full table-fixed border-collapse text-center text-[13px]">
        <caption className="sr-only">{title}</caption>
        <thead>
          <tr>
            {WEEKDAYS.map(([short, long]) => (
              <th key={short} scope="col" className="py-1.5 font-bold">
                <abbr title={long} className="no-underline">
                  {short}
                </abbr>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {monthGrid(year, monthIndex).map((week) => (
            <tr key={week[0]?.date}>
              {week.map((day) => {
                const isToday = day.date === today;
                const mark = marked[day.date];
                return (
                  <td key={day.date} className="p-0.5">
                    <span
                      className={cn(
                        'mx-auto flex size-[34px] items-center justify-center rounded-full',
                        !day.inMonth && 'text-muted',
                        isToday && 'bg-primary font-extrabold text-primary-foreground',
                        mark && !isToday && 'ring-2 ring-chart-2 ring-inset',
                      )}
                      aria-current={isToday ? 'date' : undefined}
                    >
                      {day.day}
                      {mark && <span className="sr-only">, {mark}</span>}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
