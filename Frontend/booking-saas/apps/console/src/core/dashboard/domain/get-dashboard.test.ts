// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { describe, expect, it } from 'vitest';
import type { DashboardBooking, DashboardSnapshot } from './dashboard';
import { createGetDashboard } from './get-dashboard';

const booking = (id: string, startsAt: string, status: DashboardBooking['status']) => ({
  id,
  customerName: id,
  isGuest: false,
  serviceName: 'Massage',
  therapistName: 'T',
  branchName: 'Downtown',
  startsAt,
  endsAt: startsAt,
  status,
});

const snapshot = (todaysBookings: DashboardBooking[]): DashboardSnapshot => ({
  today: '2026-11-18',
  scopeLabel: 'All branches',
  bookingsToday: todaysBookings.length,
  bookingsSameDayLastWeek: 0,
  revenueThisMonthCents: 0,
  revenueLastMonthCents: 0,
  utilization: 0,
  noShowRate: 0,
  pendingPayments: 0,
  activeTherapists: 0,
  branchCount: 1,
  monthly: [],
  todaysBookings,
  closures: [],
});

describe('getDashboard', () => {
  it('sorts today by start time and picks the next active booking as up next', async () => {
    const get = createGetDashboard(
      {
        getSnapshot: async () =>
          snapshot([
            booking('late', '2026-11-18T16:00:00.000Z', 'pending_payment'),
            booking('done', '2026-11-18T09:00:00.000Z', 'completed'),
            booking('cancelled', '2026-11-18T13:00:00.000Z', 'cancelled'),
            booking('next', '2026-11-18T14:30:00.000Z', 'confirmed'),
          ]),
      },
      () => new Date('2026-11-18T12:00:00.000Z'),
    );

    const dashboard = await get();
    expect(dashboard.todaysBookings.map((b) => b.id)).toEqual([
      'done',
      'cancelled',
      'next',
      'late',
    ]);
    expect(dashboard.upNext?.id).toBe('next');
  });

  it('has nothing up next once every active booking has started', async () => {
    const get = createGetDashboard(
      {
        getSnapshot: async () => snapshot([booking('a', '2026-11-18T09:00:00.000Z', 'confirmed')]),
      },
      () => new Date('2026-11-18T12:00:00.000Z'),
    );
    expect((await get()).upNext).toBeNull();
  });
});
