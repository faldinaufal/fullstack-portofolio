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
