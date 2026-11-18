import {
  tenantDisplayStatus,
  type PlatformOverview,
  type PlatformOverviewRepository,
  type TenantSummary,
} from './platform-overview';

export interface PlatformOverviewResult extends PlatformOverview {
  activeTenants: number;
  suspendedTenants: number;
}

const ORDER = { suspended: 0, onboarding: 1, active: 2 } as const;

/**
 * Use case: platform overview for operators.
 * Rules: tenants that need attention come first (suspended, then onboarding), then by
 * bookings in the last 30 days; tenant counts are derived from the list.
 */
export function createGetPlatformOverview(repository: PlatformOverviewRepository) {
  return async function getPlatformOverview(): Promise<PlatformOverviewResult> {
    const overview = await repository.getOverview();
    const byAttention = (a: TenantSummary, b: TenantSummary) =>
      ORDER[tenantDisplayStatus(a)] - ORDER[tenantDisplayStatus(b)] ||
      b.bookingsLast30Days - a.bookingsLast30Days;

    return {
      ...overview,
      tenants: [...overview.tenants].sort(byAttention),
      activeTenants: overview.tenants.filter((t) => t.status === 'active').length,
      suspendedTenants: overview.tenants.filter((t) => t.status === 'suspended').length,
    };
  };
}

export type GetPlatformOverview = ReturnType<typeof createGetPlatformOverview>;
