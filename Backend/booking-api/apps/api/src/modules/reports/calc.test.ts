// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { describe, expect, it } from 'vitest';
import {
  availableMinutes,
  bucketOf,
  bucketStarts,
  fillBuckets,
  ratio,
  resolveRange,
} from './calc.js';

const NY = 'America/New_York';
const weekdays = (start: string, end: string) =>
  [1, 2, 3, 4, 5].map((weekday) => ({ weekday, start, end }));

describe('report range', () => {
  const now = new Date('2026-11-23T15:00:00Z'); // Monday in New York

  it('defaults to the last 30 days, today included', () => {
    expect(resolveRange({}, NY, now)).toEqual({ from: '2026-10-25', to: '2026-11-23' });
  });

  it('refuses reversed or longer than 366 days', () => {
    expect(() => resolveRange({ from: '2026-11-10', to: '2026-11-01' }, NY, now)).toThrow();
    expect(() => resolveRange({ from: '2025-01-01', to: '2026-11-01' }, NY, now)).toThrow();
    expect(resolveRange({ from: '2026-01-01', to: '2026-12-31' }, NY, now).from).toBe('2026-01-01');
  });
});

describe('buckets', () => {
  it('start on the day, on Monday, or on the 1st', () => {
    expect(bucketOf('2026-11-25', 'day')).toBe('2026-11-25');
    expect(bucketOf('2026-11-25', 'week')).toBe('2026-11-23'); // Wednesday → Monday
    expect(bucketOf('2026-11-22', 'week')).toBe('2026-11-16'); // Sunday → previous Monday
    expect(bucketOf('2026-11-25', 'month')).toBe('2026-11-01');
  });

  it('cover the whole range, across a year end', () => {
    expect(bucketStarts('2026-11-15', '2027-01-10', 'month')).toEqual([
      '2026-11-01',
      '2026-12-01',
      '2027-01-01',
    ]);
    expect(bucketStarts('2026-11-23', '2026-12-06', 'week')).toEqual(['2026-11-23', '2026-11-30']);
  });

  it('fill gaps with zero', () => {
    const filled = fillBuckets(
      ['2026-11-23', '2026-11-24'],
      [{ start: '2026-11-24', cents: 5 }],
      (r) => ({ cents: r?.cents ?? 0 }),
    );
    expect(filled).toEqual([
      { start: '2026-11-23', cents: 0 },
      { start: '2026-11-24', cents: 5 },
    ]);
  });
});

describe('available minutes (FSD 6.14 utilization)', () => {
  const base = {
    timeZone: NY,
    working: weekdays('09:00', '18:00'),
    opening: weekdays('10:00', '17:00'),
    closures: [] as { startsOn: string; endsOn: string }[],
    timeOff: [] as { startsAt: Date; endsAt: Date }[],
  };

  it('working hours intersected with opening hours, working days only', () => {
    // Mon 23 – Sun 29 Nov: five days of 10:00–17:00 = 5 × 420.
    expect(availableMinutes({ ...base, from: '2026-11-23', to: '2026-11-29' })).toBe(2100);
  });

  it('minus closure days and time off, overlapping time off counted once', () => {
    expect(
      availableMinutes({
        ...base,
        from: '2026-11-23',
        to: '2026-11-24',
        closures: [{ startsOn: '2026-11-24', endsOn: '2026-11-24' }],
        timeOff: [
          // Monday 11:00–13:00 and 12:00–14:00 in New York: 3 hours in total.
          { startsAt: new Date('2026-11-23T16:00:00Z'), endsAt: new Date('2026-11-23T18:00:00Z') },
          { startsAt: new Date('2026-11-23T17:00:00Z'), endsAt: new Date('2026-11-23T19:00:00Z') },
        ],
      }),
    ).toBe(420 - 180);
  });

  it('a day when clocks go back counts its real length', () => {
    // Sunday 1 November 2026: 00:00–03:00 lasts 4 hours in New York.
    expect(
      availableMinutes({
        ...base,
        from: '2026-11-01',
        to: '2026-11-01',
        working: [{ weekday: 0, start: '00:00', end: '03:00' }],
        opening: [{ weekday: 0, start: '00:00', end: '03:00' }],
      }),
    ).toBe(240);
  });

  it('ratio is null without a whole', () => {
    expect(ratio(1, 4)).toBe(0.25);
    expect(ratio(0, 0)).toBeNull();
  });
});
