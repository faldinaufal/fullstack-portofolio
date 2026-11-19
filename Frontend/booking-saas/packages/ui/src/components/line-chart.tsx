// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { linePath, linePoints, niceScale } from '../lib/chart.js';
import { cn } from '../lib/cn.js';

export interface LineChartProps {
  categories: string[];
  /** `null` where there is no data: a gap in the line, not a zero. */
  values: (number | null)[];
  /** Upper bound of the axis; defaults to a "nice" scale of the largest value. */
  max?: number;
  summary: string;
  formatValue?: (value: number) => string;
  className?: string;
}

const WIDTH = 600;
const HEIGHT = 180;
const defaultFormat = (value: number) => value.toLocaleString('en-US');

/**
 * Single-series line chart drawn as inline SVG (no chart library, PRD requirement).
 * Screen readers get the summary plus the full data as a table.
 */
export function LineChart({
  categories,
  values,
  max,
  summary,
  formatValue = defaultFormat,
  className,
}: Readonly<LineChartProps>) {
  const scale = niceScale(Math.max(0, ...values.map((v) => v ?? 0)));
  const top = max ?? scale.max;
  const ticks = max === undefined ? scale.ticks : [0, top / 2, top];
  const points = linePoints(values, top, WIDTH, HEIGHT);

  return (
    <figure className={cn('m-0 flex flex-col gap-2', className)}>
      <div className="flex gap-3" aria-hidden="true">
        <div className="flex h-[180px] flex-col-reverse justify-between text-right text-[11px] text-muted">
          {ticks.map((tick) => (
            <span key={tick}>{formatValue(tick)}</span>
          ))}
        </div>
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          preserveAspectRatio="none"
          className="h-[180px] min-w-0 flex-1 overflow-visible"
        >
          {ticks.map((tick) => (
            <line
              key={tick}
              x1={0}
              x2={WIDTH}
              y1={HEIGHT - (tick / top) * HEIGHT}
              y2={HEIGHT - (tick / top) * HEIGHT}
              className="stroke-border"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          <path
            d={linePath(points)}
            fill="none"
            className="stroke-chart-1"
            strokeWidth={2.5}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
          {points.map((point, index) =>
            point ? (
              <circle
                key={categories[index]}
                cx={point.x}
                cy={point.y}
                r={3}
                className="fill-chart-1"
                vectorEffect="non-scaling-stroke"
              />
            ) : null,
          )}
        </svg>
      </div>
      <div className="flex justify-between pl-9 text-[11px] text-muted" aria-hidden="true">
        <span>{categories[0]}</span>
        <span>{categories.at(-1)}</span>
      </div>
      <figcaption className="sr-only">{summary}</figcaption>
      <table className="sr-only">
        <caption>Chart data</caption>
        <thead>
          <tr>
            <th scope="col">Period</th>
            <th scope="col">Value</th>
          </tr>
        </thead>
        <tbody>
          {categories.map((category, index) => {
            const value = values[index];
            return (
              <tr key={category}>
                <th scope="row">{category}</th>
                <td>{value === null || value === undefined ? 'No data' : formatValue(value)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </figure>
  );
}
