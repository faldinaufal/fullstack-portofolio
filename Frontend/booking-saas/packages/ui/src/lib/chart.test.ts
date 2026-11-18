import { describe, expect, it } from 'vitest';
import { monthGrid } from './calendar.js';
import { barPercent, niceScale } from './chart.js';

describe('niceScale', () => {
  it('rounds the axis up to readable ticks', () => {
    expect(niceScale(281)).toEqual({ max: 300, ticks: [0, 100, 200, 300] });
  });

  it('handles an empty series', () => {
    expect(niceScale(0)).toEqual({ max: 1, ticks: [0, 1] });
  });
});

describe('barPercent', () => {
  it('scales against the axis maximum and keeps tiny values visible', () => {
    expect(barPercent(150, 300)).toBe(50);
    expect(barPercent(1, 300)).toBe(1.5);
    expect(barPercent(0, 300)).toBe(0);
  });
});

describe('monthGrid', () => {
  it('lays out November 2026 from Sunday the 1st, padded to full weeks', () => {
    const weeks = monthGrid(2026, 10);
    expect(weeks).toHaveLength(5);
    expect(weeks[0]?.[0]).toEqual({ date: '2026-11-01', day: 1, inMonth: true });
    expect(weeks[4]?.[1]).toEqual({ date: '2026-11-30', day: 30, inMonth: true });
    expect(weeks[4]?.[6]).toEqual({ date: '2026-12-05', day: 5, inMonth: false });
  });

  it('pads the first week with the previous month', () => {
    // March 2026 starts on a Sunday too; April 2026 starts on a Wednesday.
    const april = monthGrid(2026, 3);
    expect(april[0]?.slice(0, 3).map((d) => d.date)).toEqual([
      '2026-03-29',
      '2026-03-30',
      '2026-03-31',
    ]);
  });
});
