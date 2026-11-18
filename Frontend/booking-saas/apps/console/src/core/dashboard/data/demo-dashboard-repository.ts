import type { DashboardRepository, DashboardSnapshot } from '../domain/dashboard';

/**
 * Fictional demo data for Lumen Wellness Studio until the reporting endpoints
 * (`/v1/console/reports/*`, `/v1/console/bookings`, FSD 5.4) exist. Swapping this file for an
 * HTTP repository is the only change needed; domain, presentation and UI stay the same.
 *
 * Times are stored in UTC and shown in the platform time zone (UTC in the demo).
 */
const SNAPSHOT: DashboardSnapshot = {
  today: '2026-11-18',
  scopeLabel: 'All branches',
  bookingsToday: 18,
  bookingsSameDayLastWeek: 15,
  revenueThisMonthCents: 2_468_000,
  revenueLastMonthCents: 3_124_000,
  utilization: 0.72,
  noShowRate: 0.031,
  pendingPayments: 4,
  activeTherapists: 11,
  branchCount: 3,
  monthly: [
    { month: '2025-12', completed: 182, noShow: 9 },
    { month: '2026-01', completed: 175, noShow: 8 },
    { month: '2026-02', completed: 198, noShow: 7 },
    { month: '2026-03', completed: 210, noShow: 9 },
    { month: '2026-04', completed: 224, noShow: 8 },
    { month: '2026-05', completed: 231, noShow: 10 },
    { month: '2026-06', completed: 240, noShow: 7 },
    { month: '2026-07', completed: 236, noShow: 6 },
    { month: '2026-08', completed: 252, noShow: 9 },
    { month: '2026-09', completed: 268, noShow: 8 },
    { month: '2026-10', completed: 281, noShow: 7 },
    { month: '2026-11', completed: 190, noShow: 5 },
  ],
  todaysBookings: [
    {
      id: 'b-1',
      customerName: 'Jonas W.',
      isGuest: false,
      serviceName: 'Swedish Massage',
      therapistName: 'Marco L.',
      branchName: 'Downtown',
      startsAt: '2026-11-18T09:00:00.000Z',
      endsAt: '2026-11-18T10:00:00.000Z',
      status: 'completed',
    },
    {
      id: 'b-2',
      customerName: 'Sara M.',
      isGuest: false,
      serviceName: 'Sports Physio Assessment',
      therapistName: 'Priya S.',
      branchName: 'Downtown',
      startsAt: '2026-11-18T10:30:00.000Z',
      endsAt: '2026-11-18T11:15:00.000Z',
      status: 'no_show',
    },
    {
      id: 'b-3',
      customerName: 'Leo T.',
      isGuest: true,
      serviceName: 'Follow-up Physio',
      therapistName: 'Hana T.',
      branchName: 'Riverside',
      startsAt: '2026-11-18T13:00:00.000Z',
      endsAt: '2026-11-18T13:30:00.000Z',
      status: 'confirmed',
    },
    {
      id: 'b-4',
      customerName: 'Alya P.',
      isGuest: false,
      serviceName: 'Deep Tissue Massage',
      therapistName: 'Daniel K.',
      branchName: 'Downtown',
      startsAt: '2026-11-18T14:30:00.000Z',
      endsAt: '2026-11-18T16:00:00.000Z',
      status: 'confirmed',
    },
    {
      id: 'b-5',
      customerName: 'Ravi N.',
      isGuest: false,
      serviceName: 'Swedish Massage',
      therapistName: 'Elena V.',
      branchName: 'Northgate',
      startsAt: '2026-11-18T16:00:00.000Z',
      endsAt: '2026-11-18T17:00:00.000Z',
      status: 'pending_payment',
    },
  ],
  closures: [{ date: '2026-11-26', label: 'Northgate closed' }],
};

export function createDemoDashboardRepository(): DashboardRepository {
  return {
    async getSnapshot() {
      return SNAPSHOT;
    },
  };
}

/** The demo's fixed "now", so "up next" stays meaningful whenever the demo is opened. */
export const DEMO_NOW = new Date('2026-11-18T12:00:00.000Z');
