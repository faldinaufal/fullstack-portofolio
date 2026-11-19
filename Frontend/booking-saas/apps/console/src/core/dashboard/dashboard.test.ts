// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { describe, expect, it } from 'vitest';
import { change, noShowShare, presetRange, upNext, utilizationOf } from './domain/dashboard';
import {
  bucketLabel,
  toKpis,
  toNoShowChart,
  toRevenueChart,
  toUtilizationBars,
} from './presentation/dashboard.view-model';

describe('dashboard periods', () => {
  it('end today, with a bucket size that keeps charts readable', () => {
    expect(presetRange('7d', '2026-11-23')).toEqual({
      from: '2026-11-17',
      to: '2026-11-23',
      interval: 'day',
    });
    expect(presetRange('90d', '2026-11-23')).toMatchObject({
      from: '2026-08-26',
      interval: 'week',
    });
    // Twelve whole months, this one included.
    expect(presetRange('12m', '2026-11-23')).toEqual({
      from: '2025-12-01',
      to: '2026-11-23',
      interval: 'month',
    });
  });
});

describe('dashboard rules', () => {
  it('change, utilization and no-show share have no value without a base', () => {
    expect(change(150, 100)).toBe(0.5);
    expect(change(5, 0)).toBeNull();
    expect(utilizationOf({ bookedMinutes: 120, availableMinutes: 480 })).toBe(0.25);
    expect(utilizationOf({ bookedMinutes: 0, availableMinutes: 0 })).toBeNull();
    expect(noShowShare({ finished: 4, noShows: 1 })).toBe(0.25);
    expect(noShowShare({ finished: 0, noShows: 0 })).toBeNull();
  });

  it('up next is the first active booking that has not started', () => {
    const at = (hour: number) => new Date(`2026-11-23T${String(hour).padStart(2, '0')}:00:00Z`);
    const rows = [
      { id: 'c', startsAt: at(18), status: 'confirmed' },
      { id: 'a', startsAt: at(14), status: 'confirmed' },
      { id: 'x', startsAt: at(16), status: 'cancelled' },
      { id: 'b', startsAt: at(17), status: 'pending_payment' },
    ];
    expect(upNext(rows, at(15))?.id).toBe('b');
    expect(upNext(rows, at(19))).toBeNull();
  });
});

describe('dashboard view-model', () => {
  it('formats the overview figures', () => {
    const kpis = toKpis({
      today: '2026-11-23',
      timeZone: 'America/New_York',
      bookingsToday: 6,
      bookingsSameDayLastWeek: 4,
      revenueThisMonthCents: 126_510,
      revenueLastMonthCents: 84_340,
      utilization: 0.625,
      noShowRate: null,
      paymentsPending: 2,
      activeTherapists: 3,
      branches: 1,
    });
    expect(kpis.map((k) => k.value)).toEqual(['6', '$1,265.10', '63%', '—', '2', '3']);
    expect(kpis[0]!.note).toBe('4 last Monday');
    expect(kpis[1]!.note).toBe('+50% vs last month');
    expect(kpis[5]!.note).toBe('1 branch');
  });

  it('labels buckets by their size', () => {
    expect(bucketLabel('2026-11-23', 'day')).toBe('23');
    expect(bucketLabel('2026-11-23', 'week')).toBe('23 Nov');
    expect(bucketLabel('2026-11-01', 'month')).toBe('Nov');
  });

  it('turns reports into chart data', () => {
    const revenue = toRevenueChart({
      interval: 'day',
      timeZone: 'America/New_York',
      buckets: [
        { start: '2026-11-22', cents: 0 },
        { start: '2026-11-23', cents: 8434 },
      ],
      totalCents: 8434,
      byBranch: [{ id: 'b1', name: 'Downtown', cents: 8434 }],
    });
    expect(revenue.series[0]!.values).toEqual([0, 8434]);
    expect(revenue.total).toBe('$84.34');
    expect(revenue.branches).toEqual([{ label: 'Downtown', value: 8434, display: '$84.34' }]);

    const bars = toUtilizationBars([
      { id: 'a', name: 'Ines Halvorsen', bookedMinutes: 120, availableMinutes: 480 },
      { id: 'b', name: 'Daniel Kim', bookedMinutes: 360, availableMinutes: 480 },
    ]);
    expect(bars.map((b) => [b.label, b.display])).toEqual([
      ['Daniel Kim', '75%'],
      ['Ines Halvorsen', '25%'],
    ]);

    const noShow = toNoShowChart({
      interval: 'week',
      buckets: [
        { start: '2026-11-16', finished: 0, noShows: 0 },
        { start: '2026-11-23', finished: 4, noShows: 1 },
      ],
    });
    expect(noShow.values).toEqual([null, 0.25]);
    expect(noShow.empty).toBe(false);
  });
});
