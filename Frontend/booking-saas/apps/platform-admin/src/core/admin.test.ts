// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { describe, expect, it } from 'vitest';
import { toAdmin } from './auth/data/http-admin-auth-repository';
import { initialsOf, stepUpMinutesLeft } from './auth/domain/admin-auth';
import { attentionItems, type PlatformOverview } from './overview/domain/overview';
import { toOverviewView } from './overview/presentation/use-overview';
import { toTenantDetail } from './tenants/data/http-tenant-repository';
import { displayStatus, suggestSlug } from './tenants/domain/tenant';

const now = new Date('2026-11-23T15:00:00Z');

describe('step-up status (FSD 6.11)', () => {
  it('counts the minutes left, zero once a code is needed', () => {
    expect(stepUpMinutesLeft({ stepUpValidUntil: new Date('2026-11-23T15:06:30Z') }, now)).toBe(7);
    expect(stepUpMinutesLeft({ stepUpValidUntil: new Date('2026-11-23T14:59:00Z') }, now)).toBe(0);
    expect(stepUpMinutesLeft({ stepUpValidUntil: null }, now)).toBe(0);
    expect(
      toAdmin({ id: 'a', email: 'ops@veloria.test', name: 'Ines', stepUpValidUntil: null })
        .stepUpValidUntil,
    ).toBeNull();
    expect(initialsOf('Ines Halvorsen')).toBe('IH');
  });
});

describe('tenants', () => {
  it('reads suspended first, then onboarding, then active', () => {
    expect(displayStatus({ status: 'suspended', onboarding: true })).toBe('suspended');
    expect(displayStatus({ status: 'active', onboarding: true })).toBe('onboarding');
    expect(displayStatus({ status: 'active', onboarding: false })).toBe('active');
  });

  it('suggests a slug from the business name', () => {
    expect(suggestSlug('Harbor Bodywork & Spa')).toBe('harbor-bodywork-spa');
    expect(suggestSlug('  Café Ünïque  ')).toBe('cafe-unique');
  });

  it('maps dates of the detail', () => {
    const detail = toTenantDetail({
      id: 'fa1d0000-0000-4000-8000-000000004217',
      name: 'Harbor Bodywork',
      slug: 'harbor',
      status: 'suspended',
      onboarding: false,
      createdAt: '2026-11-20T10:00:00.000Z',
      members: 3,
      recentBookings: 12,
      invoicePrefix: 'HAR',
      suspendedAt: '2026-11-22T09:00:00.000Z',
      suspensionReason: 'Card payments disputed',
      owner: { name: 'Jonah Reed', email: 'jonah@veloria.test' },
      ownerInvitation: null,
    });
    expect(detail.suspendedAt).toEqual(new Date('2026-11-22T09:00:00Z'));
    expect(detail.ownerInvitation).toBeNull();
  });
});

describe('overview', () => {
  const overview: PlatformOverview = {
    timeZone: 'America/New_York',
    tenants: { active: 4, onboarding: 1, suspended: 1 },
    days: [
      { date: '2026-11-22', bookings: 3, payments: 2, revenueCents: 8434 },
      { date: '2026-11-23', bookings: 5, payments: 4, revenueCents: 16_868 },
    ],
    health: { paymentsNeedingAttention: 1, emailsQueued: 0, emailsFailed: 0 },
  };

  it('lists what needs attention', () => {
    expect(attentionItems(overview)).toEqual([
      '1 payment arrived for bookings that no longer wait for them',
      '1 suspended tenant',
    ]);
    expect(
      attentionItems({
        ...overview,
        tenants: { ...overview.tenants, suspended: 0 },
        health: { paymentsNeedingAttention: 0, emailsQueued: 3, emailsFailed: 0 },
      }),
    ).toEqual([]);
  });

  it('sums the 14 days for the cards and keeps both series for the chart', () => {
    const view = toOverviewView(overview);
    expect(view.kpis.map((k) => k.value)).toEqual(['4', '8', '$253.02', '0']);
    expect(view.kpis[1]!.note).toBe('5 today');
    expect(view.chart.categories).toEqual(['22', '23']);
    expect(view.chart.series.map((s) => s.values)).toEqual([
      [3, 5],
      [2, 4],
    ]);
  });
});
