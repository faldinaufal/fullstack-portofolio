// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

/** Platform metrics (FSD 2.3 Overview). */
export interface PlatformOverview {
  timeZone: string;
  tenants: { active: number; onboarding: number; suspended: number };
  /** The last 14 days, oldest first. */
  days: { date: string; bookings: number; payments: number; revenueCents: number }[];
  health: { paymentsNeedingAttention: number; emailsQueued: number; emailsFailed: number };
}

export interface OverviewRepository {
  get(): Promise<PlatformOverview>;
}

/** What needs someone's attention now; empty when all is well. */
export function attentionItems(overview: PlatformOverview): string[] {
  const items: string[] = [];
  const { health } = overview;
  if (health.paymentsNeedingAttention > 0) {
    items.push(
      `${health.paymentsNeedingAttention} payment${health.paymentsNeedingAttention === 1 ? '' : 's'} arrived for bookings that no longer wait for them`,
    );
  }
  if (health.emailsFailed > 0) {
    items.push(
      `${health.emailsFailed} email${health.emailsFailed === 1 ? '' : 's'} failed in the last 24 hours`,
    );
  }
  if (overview.tenants.suspended > 0) {
    items.push(
      `${overview.tenants.suspended} suspended tenant${overview.tenants.suspended === 1 ? '' : 's'}`,
    );
  }
  return items;
}
