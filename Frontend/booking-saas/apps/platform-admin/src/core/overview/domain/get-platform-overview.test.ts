import { describe, expect, it } from 'vitest';
import { createGetPlatformOverview } from './get-platform-overview';
import { tenantDisplayStatus, type TenantSummary } from './platform-overview';

const tenant = (overrides: Partial<TenantSummary>): TenantSummary => ({
  id: 't',
  name: 'T',
  slug: 't',
  status: 'active',
  setupComplete: true,
  branches: 1,
  members: 1,
  bookingsLast30Days: 0,
  supportGrantExpiresAt: null,
  ...overrides,
});

describe('tenantDisplayStatus', () => {
  it('derives onboarding for active tenants that are not set up yet', () => {
    expect(tenantDisplayStatus(tenant({ setupComplete: false }))).toBe('onboarding');
    expect(tenantDisplayStatus(tenant({ status: 'suspended', setupComplete: false }))).toBe(
      'suspended',
    );
    expect(tenantDisplayStatus(tenant({}))).toBe('active');
  });
});

describe('getPlatformOverview', () => {
  it('lists tenants needing attention first and counts them', async () => {
    const get = createGetPlatformOverview({
      getOverview: async () => ({
        today: '2026-11-18',
        tenantsCreatedThisWeek: 0,
        bookingsToday: 0,
        bookingsYesterday: 0,
        paymentsTodayCents: 0,
        apiErrorRate: 0,
        jobsWaiting: 0,
        daily: [],
        services: [],
        tenants: [
          tenant({ id: 'small', bookingsLast30Days: 10 }),
          tenant({ id: 'big', bookingsLast30Days: 900 }),
          tenant({ id: 'new', setupComplete: false }),
          tenant({ id: 'off', status: 'suspended' }),
        ],
      }),
    });

    const overview = await get();
    expect(overview.tenants.map((t) => t.id)).toEqual(['off', 'new', 'big', 'small']);
    expect(overview.activeTenants).toBe(3);
    expect(overview.suspendedTenants).toBe(1);
  });
});
