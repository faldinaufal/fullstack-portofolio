// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

export type ServiceState = 'healthy' | 'degraded' | 'down';

export interface ServiceHealth {
  name: string;
  state: ServiceState;
  detail: string;
}

export interface TenantSummary {
  id: string;
  name: string;
  slug: string;
  /** Stored status (FSD 4.3: `active` | `suspended`). */
  status: 'active' | 'suspended';
  /** Has at least one branch, service and therapist with working hours (FSD 3.4). */
  setupComplete: boolean;
  branches: number;
  members: number;
  bookingsLast30Days: number;
  /** ISO 8601 expiry of an active support grant, or null. */
  supportGrantExpiresAt: string | null;
}

export interface DailyBookings {
  /** `YYYY-MM-DD`. */
  date: string;
  created: number;
  expiredUnpaid: number;
}

export interface PlatformOverview {
  today: string;
  tenantsCreatedThisWeek: number;
  bookingsToday: number;
  bookingsYesterday: number;
  paymentsTodayCents: number;
  /** Share of 5xx responses over the last 24 h, 0–1. */
  apiErrorRate: number;
  jobsWaiting: number;
  daily: DailyBookings[];
  services: ServiceHealth[];
  tenants: TenantSummary[];
}

export interface PlatformOverviewRepository {
  getOverview(): Promise<PlatformOverview>;
}

/** What operators see as a tenant's state. "Onboarding" is derived, never stored. */
export type TenantDisplayStatus = 'active' | 'onboarding' | 'suspended';

export function tenantDisplayStatus(tenant: TenantSummary): TenantDisplayStatus {
  if (tenant.status === 'suspended') return 'suspended';
  return tenant.setupComplete ? 'active' : 'onboarding';
}
