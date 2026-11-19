// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { barPercent } from '../lib/chart.js';
import { cn } from '../lib/cn.js';

export interface HBarItem {
  label: string;
  /** Drives the bar length. */
  value: number;
  /** Shown at the end of the row, e.g. "12 · $506". */
  display: string;
  /** Optional note next to the label. */
  hint?: string;
}

export interface HBarListProps {
  items: HBarItem[];
  /** Bar length at 100 %; defaults to the largest value. */
  max?: number;
  /** One-sentence description, read by screen readers with the list. */
  summary: string;
  empty?: string;
  className?: string;
}

/**
 * Ranked horizontal bars (services, branches, therapists) in plain HTML and CSS: no chart
 * library (PRD requirement). The rows are a real list, so screen readers read every value.
 */
export function HBarList({
  items,
  max,
  summary,
  empty = 'No data yet.',
  className,
}: Readonly<HBarListProps>) {
  const top = max ?? Math.max(0, ...items.map((i) => i.value));
  if (items.length === 0) return <p className="text-sm text-muted">{empty}</p>;
  return (
    <figure className={cn('m-0', className)}>
      <figcaption className="sr-only">{summary}</figcaption>
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {items.map((item) => (
          <li key={item.label} className="flex flex-col gap-1">
            <span className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate font-semibold">
                {item.label}
                {item.hint && (
                  <span className="ml-2 text-xs font-normal text-muted">{item.hint}</span>
                )}
              </span>
              <span className="shrink-0 tabular-nums">{item.display}</span>
            </span>
            <span
              className="block h-2 overflow-hidden rounded-full bg-surface-muted"
              aria-hidden="true"
            >
              <span
                className="block h-full rounded-full bg-chart-1"
                style={{ width: `${barPercent(item.value, top)}%` }}
              />
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}
