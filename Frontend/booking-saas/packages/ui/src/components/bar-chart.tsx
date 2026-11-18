import { barPercent, niceScale } from '../lib/chart.js';
import { cn } from '../lib/cn.js';

export interface BarSeries {
  name: string;
  values: number[];
  /** Theme colour of the series. */
  color: 'chart-1' | 'chart-2';
}

export interface BarChartProps {
  categories: string[];
  series: BarSeries[];
  /** One-sentence description of what the chart shows, read by screen readers. */
  summary: string;
  /** Formats axis labels and table cells. */
  formatValue?: (value: number) => string;
  className?: string;
}

const BAR_COLOR: Record<BarSeries['color'], string> = {
  'chart-1': 'bg-chart-1',
  'chart-2': 'bg-chart-2',
};

const defaultFormat = (value: number) => value.toLocaleString('en-US');

/**
 * Grouped bar chart drawn with plain HTML and CSS (no chart library, PRD requirement).
 * Screen readers get the summary plus the full data as a table.
 */
export function BarChart({
  categories,
  series,
  summary,
  formatValue = defaultFormat,
  className,
}: Readonly<BarChartProps>) {
  const { max, ticks } = niceScale(Math.max(0, ...series.flatMap((s) => s.values)));

  return (
    <figure className={cn('m-0 flex flex-col gap-4', className)}>
      <div className="flex flex-wrap gap-4 text-xs text-muted" aria-hidden="true">
        {series.map((s) => (
          <span key={s.name} className="flex items-center gap-1.5">
            <span className={cn('size-2.5 rounded-[3px]', BAR_COLOR[s.color])} />
            {s.name}
          </span>
        ))}
      </div>

      <div className="flex gap-3" aria-hidden="true">
        <div className="flex h-[220px] flex-col-reverse justify-between pb-6 text-right text-[11px] text-muted">
          {ticks.map((tick) => (
            <span key={tick}>{formatValue(tick)}</span>
          ))}
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="relative flex h-[196px] items-end justify-between gap-1.5 border-b border-border">
            {ticks.slice(1).map((tick) => (
              <span
                key={tick}
                className="pointer-events-none absolute inset-x-0 border-t border-border"
                style={{ bottom: `${(tick / max) * 100}%` }}
              />
            ))}
            {categories.map((category, index) => (
              <div
                key={category}
                className="relative flex h-full flex-1 items-end justify-center gap-[3px]"
              >
                {series.map((s) => (
                  <span
                    key={s.name}
                    className={cn('block w-[40%] max-w-3.5 rounded-t', BAR_COLOR[s.color])}
                    style={{ height: `${barPercent(s.values[index] ?? 0, max)}%` }}
                  />
                ))}
              </div>
            ))}
          </div>
          <div className="flex justify-between gap-1.5 pt-2">
            {categories.map((category) => (
              <span key={category} className="flex-1 text-center text-[11px] text-muted">
                {category}
              </span>
            ))}
          </div>
        </div>
      </div>

      <figcaption className="sr-only">{summary}</figcaption>
      <table className="sr-only">
        <caption>Chart data</caption>
        <thead>
          <tr>
            <th scope="col">Category</th>
            {series.map((s) => (
              <th key={s.name} scope="col">
                {s.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {categories.map((category, index) => (
            <tr key={category}>
              <th scope="row">{category}</th>
              {series.map((s) => (
                <td key={s.name}>{formatValue(s.values[index] ?? 0)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
