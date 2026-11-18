// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { PlatformOverview, PlatformOverviewRepository } from '../domain/platform-overview';

/**
 * Fictional demo data until the platform endpoints (`/v1/admin/overview`,
 * `/v1/admin/tenants`, FSD 5.5) exist. Swapping this file for an HTTP repository is the only
 * change needed; domain, presentation and UI stay the same.
 */
const OVERVIEW: PlatformOverview = {
  today: '2026-11-18',
  tenantsCreatedThisWeek: 2,
  bookingsToday: 236,
  bookingsYesterday: 221,
  paymentsTodayCents: 1_894_000,
  apiErrorRate: 0.002,
  jobsWaiting: 3,
  daily: [
    ['05', 198, 9],
    ['06', 205, 11],
    ['07', 172, 6],
    ['08', 168, 4],
    ['09', 214, 8],
    ['10', 230, 12],
    ['11', 241, 15],
    ['12', 219, 9],
    ['13', 226, 10],
    ['14', 181, 7],
    ['15', 175, 5],
    ['16', 233, 11],
    ['17', 251, 13],
    ['18', 236, 8],
  ].map(([day, created, expiredUnpaid]) => ({
    date: `2026-11-${day}`,
    created: Number(created),
    expiredUnpaid: Number(expiredUnpaid),
  })),
  services: [
    { name: 'API', state: 'healthy', detail: 'p95 182 ms · ready' },
    { name: 'Worker', state: 'healthy', detail: 'Last heartbeat 2 min ago' },
    { name: 'Database', state: 'healthy', detail: 'Migrations up to date' },
    { name: 'Stripe webhooks', state: 'healthy', detail: 'Last event 40 s ago' },
    { name: 'Email delivery', state: 'degraded', detail: '1 message retrying (attempt 2 of 5)' },
  ],
  tenants: [
    {
      id: 't-lumen',
      name: 'Lumen Wellness Studio',
      slug: 'lumen',
      status: 'active',
      setupComplete: true,
      branches: 3,
      members: 14,
      bookingsLast30Days: 1204,
      supportGrantExpiresAt: '2026-11-19T06:00:00.000Z',
    },
    {
      id: 't-harbor',
      name: 'Harbor Physio Clinic',
      slug: 'harbor-physio',
      status: 'active',
      setupComplete: true,
      branches: 2,
      members: 6,
      bookingsLast30Days: 488,
      supportGrantExpiresAt: null,
    },
    {
      id: 't-northwind',
      name: 'Northwind Yoga',
      slug: 'northwind-yoga',
      status: 'active',
      setupComplete: false,
      branches: 1,
      members: 2,
      bookingsLast30Days: 0,
      supportGrantExpiresAt: null,
    },
    {
      id: 't-bluepine',
      name: 'Blue Pine Spa',
      slug: 'blue-pine',
      status: 'suspended',
      setupComplete: true,
      branches: 1,
      members: 4,
      bookingsLast30Days: 37,
      supportGrantExpiresAt: null,
    },
  ],
};

export function createDemoPlatformOverviewRepository(): PlatformOverviewRepository {
  return {
    async getOverview() {
      return OVERVIEW;
    },
  };
}

/** The demo's fixed "now", so time-based labels stay meaningful whenever the demo is opened. */
export const DEMO_NOW = new Date('2026-11-18T12:00:00.000Z');
