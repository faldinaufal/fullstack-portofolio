import type { PlatformOverviewResult } from '../domain/get-platform-overview';
import {
  tenantDisplayStatus,
  type ServiceState,
  type TenantDisplayStatus,
} from '../domain/platform-overview';

export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';
export type KpiIcon = 'tenants' | 'pause' | 'calendar-check' | 'card' | 'pulse' | 'queue';

export interface PlatformOverviewViewModel {
  dateLabel: string;
  kpis: { value: string; label: string; note: string; icon: KpiIcon }[];
  chart: {
    categories: string[];
    series: { name: string; values: number[]; color: 'chart-1' | 'chart-2' }[];
    summary: string;
  };
  services: { name: string; detail: string; status: string; tone: Tone }[];
  tenants: {
    id: string;
    initial: string;
    name: string;
    slug: string;
    status: string;
    tone: Tone;
    branches: number;
    members: number;
    bookings: string;
    support: string;
  }[];
}

const SERVICE: Record<ServiceState, { label: string; tone: Tone }> = {
  healthy: { label: 'Healthy', tone: 'success' },
  degraded: { label: 'Degraded', tone: 'warning' },
  down: { label: 'Down', tone: 'danger' },
};

const TENANT: Record<TenantDisplayStatus, { label: string; tone: Tone }> = {
  active: { label: 'Active', tone: 'success' },
  onboarding: { label: 'Onboarding', tone: 'info' },
  suspended: { label: 'Suspended', tone: 'danger' },
};

const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});
const count = new Intl.NumberFormat('en-US');

function longDate(isoDate: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).formatToParts(new Date(`${isoDate}T00:00:00.000Z`));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';
  return `${part('weekday')}, ${part('day')} ${part('month')} ${part('year')}`;
}

/** "Granted · 18 h left" while a support grant is active, otherwise "None". */
export function supportLabel(expiresAt: string | null, now: Date): string {
  if (!expiresAt) return 'None';
  const msLeft = new Date(expiresAt).getTime() - now.getTime();
  if (msLeft <= 0) return 'None';
  const hours = Math.floor(msLeft / 3_600_000);
  return hours >= 1 ? `Granted · ${hours} h left` : 'Granted · under 1 h left';
}

export function toPlatformOverviewViewModel(
  overview: PlatformOverviewResult,
  now: Date,
): PlatformOverviewViewModel {
  const created = overview.daily.map((d) => d.created);
  const expired = overview.daily.map((d) => d.expiredUnpaid);

  return {
    dateLabel: longDate(overview.today),
    kpis: [
      {
        value: String(overview.activeTenants),
        label: 'Active tenants',
        note: `${overview.tenantsCreatedThisWeek} created this week`,
        icon: 'tenants',
      },
      {
        value: String(overview.suspendedTenants),
        label: 'Suspended',
        note: 'Reason recorded in the audit log',
        icon: 'pause',
      },
      {
        value: count.format(overview.bookingsToday),
        label: 'Bookings today',
        note: `Yesterday: ${count.format(overview.bookingsYesterday)}`,
        icon: 'calendar-check',
      },
      {
        value: money.format(overview.paymentsTodayCents / 100),
        label: 'Payments today',
        note: 'Stripe test mode',
        icon: 'card',
      },
      {
        value: new Intl.NumberFormat('en-US', {
          style: 'percent',
          maximumFractionDigits: 1,
        }).format(overview.apiErrorRate),
        label: 'API error rate',
        note: 'Last 24 h · 5xx responses',
        icon: 'pulse',
      },
      {
        value: String(overview.jobsWaiting),
        label: 'Jobs waiting',
        note: 'Emails, reminders, hold expiry',
        icon: 'queue',
      },
    ],
    chart: {
      categories: overview.daily.map((d) => String(Number(d.date.slice(8)))),
      series: [
        { name: 'Created', values: created, color: 'chart-1' },
        { name: 'Expired unpaid', values: expired, color: 'chart-2' },
      ],
      summary:
        overview.daily.length === 0
          ? 'No bookings yet.'
          : `Bookings created per day across all tenants over the last ${overview.daily.length} days ranged from ${Math.min(...created)} to ${Math.max(...created)}; between ${Math.min(...expired)} and ${Math.max(...expired)} per day expired unpaid.`,
    },
    services: overview.services.map((service) => ({
      name: service.name,
      detail: service.detail,
      status: SERVICE[service.state].label,
      tone: SERVICE[service.state].tone,
    })),
    tenants: overview.tenants.map((tenant) => {
      const status = TENANT[tenantDisplayStatus(tenant)];
      return {
        id: tenant.id,
        initial: tenant.name.charAt(0).toUpperCase(),
        name: tenant.name,
        slug: tenant.slug,
        status: status.label,
        tone: status.tone,
        branches: tenant.branches,
        members: tenant.members,
        bookings: count.format(tenant.bookingsLast30Days),
        support: supportLabel(tenant.supportGrantExpiresAt, now),
      };
    }),
  };
}
