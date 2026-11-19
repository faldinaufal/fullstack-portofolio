// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

/**
 * Picks a "nice" upper bound and evenly spaced ticks for a bar chart axis,
 * so labels read 0 / 100 / 200 / 300 instead of 0 / 93.67 / 187.33 / 281.
 */
export function niceScale(maxValue: number, tickCount = 4): { max: number; ticks: number[] } {
  if (maxValue <= 0) return { max: 1, ticks: [0, 1] };
  const roughStep = maxValue / (tickCount - 1);
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const step =
    [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= roughStep) ?? 10 * magnitude;
  const max = Math.ceil(maxValue / step) * step;
  const ticks: number[] = [];
  for (let value = 0; value <= max + step / 2; value += step) {
    ticks.push(Math.round(value * 100) / 100);
  }
  return { max, ticks };
}

/** Bar height as a percentage of the plot, with a minimum so tiny values stay visible. */
export function barPercent(value: number, max: number, minPercent = 1.5): number {
  if (max <= 0 || value <= 0) return 0;
  return Math.max(minPercent, (value / max) * 100);
}

/**
 * Points of a line chart in a `width` x `height` box (SVG coordinates, y grows downwards).
 * `null` values leave a gap: the line breaks there instead of dropping to zero.
 */
export function linePoints(
  values: (number | null)[],
  max: number,
  width: number,
  height: number,
): ({ x: number; y: number } | null)[] {
  const step = values.length > 1 ? width / (values.length - 1) : 0;
  return values.map((value, index) => {
    if (value === null) return null;
    const x = values.length > 1 ? index * step : width / 2;
    const share = max > 0 ? Math.min(value, max) / max : 0;
    return { x, y: height - share * height };
  });
}

/** SVG path through the points, starting a new segment after every gap. */
export function linePath(points: ({ x: number; y: number } | null)[]): string {
  const parts: string[] = [];
  let drawing = false;
  for (const point of points) {
    if (!point) {
      drawing = false;
      continue;
    }
    parts.push(`${drawing ? 'L' : 'M'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`);
    drawing = true;
  }
  return parts.join(' ');
}
