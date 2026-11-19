// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import { useQuery } from '@tanstack/react-query';
import { useDependencies } from '../../shared/presentation/dependencies';
import { attentionItems, type PlatformOverview } from '../domain/overview';

const money = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);

/** KPI cards, the 14-day chart and the attention list of the overview (FSD 2.3). */
export function toOverviewView(overview: PlatformOverview) {
  const days = overview.days;
  const revenue = days.reduce((sum, d) => sum + d.revenueCents, 0);
  const label = (date: string) =>
    new Intl.DateTimeFormat('en-GB', { day: 'numeric', timeZone: 'UTC' }).format(
      new Date(`${date}T12:00:00Z`),
    );
  return {
    kpis: [
      {
        value: String(overview.tenants.active),
        label: 'Active tenants',
        note: `${overview.tenants.onboarding} onboarding · ${overview.tenants.suspended} suspended`,
        icon: 'tenants' as const,
      },
      {
        value: String(days.reduce((sum, d) => sum + d.bookings, 0)),
        label: 'Bookings, 14 days',
        note: `${days.at(-1)?.bookings ?? 0} today`,
        icon: 'calendar-check' as const,
      },
      {
        value: money(revenue),
        label: 'Payments, 14 days',
        note: `${days.reduce((sum, d) => sum + d.payments, 0)} paid invoices`,
        icon: 'revenue' as const,
      },
      {
        value: String(overview.health.emailsQueued),
        label: 'Emails waiting',
        note: `${overview.health.emailsFailed} failed in 24 h`,
        icon: 'emails' as const,
      },
    ],
    chart: {
      categories: days.map((d) => label(d.date)),
      series: [
        { name: 'Bookings made', values: days.map((d) => d.bookings), color: 'chart-1' as const },
        { name: 'Paid invoices', values: days.map((d) => d.payments), color: 'chart-2' as const },
      ],
      summary: 'Bookings made and invoices paid per day over the last 14 days.',
    },
    attention: attentionItems(overview),
  };
}

export function useOverview() {
  const { overview } = useDependencies();
  return useQuery({
    queryKey: ['overview'],
    queryFn: () => overview.get(),
    select: toOverviewView,
    refetchInterval: 60_000,
  });
}
