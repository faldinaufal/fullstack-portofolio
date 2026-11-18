// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { DashboardBooking, DashboardRepository, DashboardSnapshot } from './dashboard';

export interface Dashboard extends DashboardSnapshot {
  /** The next booking that still needs the business's attention, if any. */
  upNext: DashboardBooking | null;
}

const ACTIVE: DashboardBooking['status'][] = ['confirmed', 'pending_payment'];

/**
 * Use case: load the owner dashboard.
 * Rules: today's bookings are listed by start time; "up next" is the first active booking
 * that has not started yet at `now`.
 */
export function createGetDashboard(
  repository: DashboardRepository,
  now: () => Date = () => new Date(),
) {
  return async function getDashboard(): Promise<Dashboard> {
    const snapshot = await repository.getSnapshot();
    const todaysBookings = [...snapshot.todaysBookings].sort((a, b) =>
      a.startsAt.localeCompare(b.startsAt),
    );
    const currentTime = now().toISOString();
    const upNext =
      todaysBookings.find((b) => ACTIVE.includes(b.status) && b.startsAt > currentTime) ?? null;
    return { ...snapshot, todaysBookings, upNext };
  };
}

export type GetDashboard = ReturnType<typeof createGetDashboard>;
