// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import {
  change,
  noShowShare,
  utilizationOf,
  type NoShowSeries,
  type Overview,
  type ReportInterval,
  type RevenueSeries,
  type ServiceStat,
  type UtilizationReport,
} from '../domain/dashboard';

/** Formatting of the dashboard's figures and series for the chart components. */

export type KpiIcon = 'calendar-check' | 'revenue' | 'utilization' | 'no-show' | 'timer' | 'team';

export interface KpiViewModel {
  value: string;
  label: string;
  note: string;
  icon: KpiIcon;
}

const money = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
const moneyShort = (cents: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(cents / 100);
export const percent = (share: number | null) =>
  share === null ? '—' : `${Math.round(share * 100)}%`;
const signed = (share: number | null) =>
  share === null
    ? 'no data last month'
    : `${share >= 0 ? '+' : ''}${Math.round(share * 100)}% vs last month`;

const weekdayOf = (date: string) =>
  new Intl.DateTimeFormat('en-GB', { weekday: 'long', timeZone: 'UTC' }).format(
    new Date(`${date}T12:00:00Z`),
  );

export function toKpis(o: Overview): KpiViewModel[] {
  return [
    {
      value: String(o.bookingsToday),
      label: 'Bookings today',
      note: `${o.bookingsSameDayLastWeek} last ${weekdayOf(o.today)}`,
      icon: 'calendar-check',
    },
    {
      value: money(o.revenueThisMonthCents),
      label: 'Revenue this month',
      note: signed(change(o.revenueThisMonthCents, o.revenueLastMonthCents)),
      icon: 'revenue',
    },
    {
      value: percent(o.utilization),
      label: 'Utilization',
      note: 'Booked of available hours, last 30 days',
      icon: 'utilization',
    },
    {
      value: percent(o.noShowRate),
      label: 'No-show rate',
      note: 'Of marked sessions, last 30 days',
      icon: 'no-show',
    },
    {
      value: String(o.paymentsPending),
      label: 'Awaiting payment',
      note: 'Times held while customers pay',
      icon: 'timer',
    },
    {
      value: String(o.activeTherapists),
      label: 'Therapists',
      note: `${o.branches} branch${o.branches === 1 ? '' : 'es'}`,
      icon: 'team',
    },
  ];
}

/** Axis label of a bucket: day of month, "23 Nov" for weeks, "Nov" for months. */
export function bucketLabel(start: string, interval: ReportInterval): string {
  const date = new Date(`${start}T12:00:00Z`);
  const format = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('en-GB', { ...options, timeZone: 'UTC' }).format(date);
  if (interval === 'day') return format({ day: 'numeric' });
  if (interval === 'week') return format({ day: 'numeric', month: 'short' });
  return format({ month: 'short' });
}

export function toRevenueChart(revenue: RevenueSeries) {
  return {
    categories: revenue.buckets.map((b) => bucketLabel(b.start, revenue.interval)),
    series: [
      { name: 'Revenue', values: revenue.buckets.map((b) => b.cents), color: 'chart-1' as const },
    ],
    formatValue: moneyShort,
    summary: `Revenue per ${revenue.interval}: ${money(revenue.totalCents)} in total.`,
    total: money(revenue.totalCents),
    branches: revenue.byBranch.map((b) => ({
      label: b.name,
      value: b.cents,
      display: money(b.cents),
    })),
  };
}

export function toServiceBars(items: ServiceStat[]) {
  return items.map((s) => ({
    label: s.name,
    value: s.bookings,
    display: `${s.bookings} · ${money(s.revenueCents)}`,
  }));
}

/** Utilization rows as bars on a 0–100 % scale, highest first. */
export function toUtilizationBars(
  rows: UtilizationReport['therapists'] | UtilizationReport['branches'],
) {
  return rows
    .map((row) => {
      const share = utilizationOf(row);
      return {
        label: row.name,
        value: share ?? 0,
        display: percent(share),
        hint: `${Math.round(row.bookedMinutes / 60)} of ${Math.round(row.availableMinutes / 60)} h`,
      };
    })
    .sort((a, b) => b.value - a.value);
}

export function toNoShowChart(series: NoShowSeries) {
  const values = series.buckets.map(noShowShare);
  const marked = series.buckets.reduce((s, b) => s + b.finished, 0);
  const missed = series.buckets.reduce((s, b) => s + b.noShows, 0);
  return {
    categories: series.buckets.map((b) => bucketLabel(b.start, series.interval)),
    values,
    formatValue: (v: number) => `${Math.round(v * 100)}%`,
    summary: `No-show rate per ${series.interval}: ${missed} of ${marked} marked sessions.`,
    empty: marked === 0,
  };
}
