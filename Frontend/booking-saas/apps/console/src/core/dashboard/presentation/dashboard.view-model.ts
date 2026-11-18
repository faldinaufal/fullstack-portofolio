import type { BookingStatus, DashboardBooking } from '../domain/dashboard';
import type { Dashboard } from '../domain/get-dashboard';

/** Platform time zone (FSD 6: one time zone for the whole platform). */
const TIME_ZONE = process.env.NEXT_PUBLIC_APP_TIME_ZONE ?? 'UTC';

export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';
export type KpiIcon = 'calendar-check' | 'revenue' | 'utilization' | 'no-show' | 'timer' | 'team';

export interface KpiViewModel {
  value: string;
  label: string;
  note: string;
  icon: KpiIcon;
}

export interface BookingRowViewModel {
  id: string;
  time: string;
  customer: string;
  service: string;
  therapist: string;
  branch: string;
  status: string;
  tone: Tone;
}

export interface UpNextViewModel {
  title: string;
  initials: string;
  customer: string;
  detail: string;
  status: string;
  tone: Tone;
}

export interface DashboardViewModel {
  dateLabel: string;
  scopeLabel: string;
  kpis: KpiViewModel[];
  chart: {
    categories: string[];
    series: { name: string; values: number[]; color: 'chart-1' | 'chart-2' }[];
    summary: string;
  };
  calendar: { year: number; monthIndex: number; today: string; marked: Record<string, string> };
  upNext: UpNextViewModel | null;
  todaysBookings: BookingRowViewModel[];
}

const STATUS: Record<BookingStatus, { label: string; tone: Tone }> = {
  pending_payment: { label: 'Pending payment', tone: 'warning' },
  confirmed: { label: 'Confirmed', tone: 'success' },
  completed: { label: 'Completed', tone: 'info' },
  no_show: { label: 'No-show', tone: 'danger' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
  expired: { label: 'Expired', tone: 'neutral' },
};

const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});
const percent = (value: number, digits: number) =>
  new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: digits }).format(value);
const time = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: TIME_ZONE,
});

function monthLabel(month: string): string {
  return new Date(`${month}-01T00:00:00.000Z`).toLocaleDateString('en-US', {
    month: 'short',
    timeZone: 'UTC',
  });
}

/** "Wednesday, 18 November 2026", built from parts so it does not depend on ICU punctuation. */
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

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part.charAt(0))
    .join('')
    .replace(/[^A-Za-z]/g, '')
    .slice(0, 2)
    .toUpperCase();
}

function customerLabel(booking: DashboardBooking): string {
  return booking.isGuest ? `Guest · ${booking.customerName}` : booking.customerName;
}

/** Pure mapping from the dashboard use case to what the screen shows. */
export function toDashboardViewModel(dashboard: Dashboard): DashboardViewModel {
  const [year, month] = dashboard.today.split('-').map(Number) as [number, number];
  const peak = dashboard.monthly.reduce(
    (best, m) => (m.completed > best.completed ? m : best),
    dashboard.monthly[0] ?? { month: dashboard.today.slice(0, 7), completed: 0, noShow: 0 },
  );
  const noShows = dashboard.monthly.map((m) => m.noShow);

  return {
    dateLabel: longDate(dashboard.today),
    scopeLabel: dashboard.scopeLabel,
    kpis: [
      {
        value: String(dashboard.bookingsToday),
        label: 'Bookings today',
        note: `Same day last week: ${dashboard.bookingsSameDayLastWeek}`,
        icon: 'calendar-check',
      },
      {
        value: money.format(dashboard.revenueThisMonthCents / 100),
        label: 'Revenue this month',
        note: `Last month: ${money.format(dashboard.revenueLastMonthCents / 100)}`,
        icon: 'revenue',
      },
      {
        value: percent(dashboard.utilization, 0),
        label: 'Utilization',
        note: 'Booked vs available hours',
        icon: 'utilization',
      },
      {
        value: percent(dashboard.noShowRate, 1),
        label: 'No-show rate',
        note: 'Last 30 days',
        icon: 'no-show',
      },
      {
        value: String(dashboard.pendingPayments),
        label: 'Pending payments',
        note: 'Slots held for up to 30 min',
        icon: 'timer',
      },
      {
        value: String(dashboard.activeTherapists),
        label: 'Active therapists',
        note: `Across ${dashboard.branchCount} ${dashboard.branchCount === 1 ? 'branch' : 'branches'}`,
        icon: 'team',
      },
    ],
    chart: {
      categories: dashboard.monthly.map((m) => monthLabel(m.month)),
      series: [
        { name: 'Completed', values: dashboard.monthly.map((m) => m.completed), color: 'chart-1' },
        { name: 'No-show', values: noShows, color: 'chart-2' },
      ],
      summary:
        dashboard.monthly.length === 0
          ? 'No bookings yet.'
          : `Completed bookings per month peaked at ${peak.completed} in ${monthLabel(peak.month)}; no-shows stayed between ${Math.min(...noShows)} and ${Math.max(...noShows)} per month.`,
    },
    calendar: {
      year,
      monthIndex: month - 1,
      today: dashboard.today,
      marked: Object.fromEntries(dashboard.closures.map((c) => [c.date, c.label])),
    },
    upNext: dashboard.upNext && {
      title: `Up next · ${dashboard.upNext.branchName}`,
      initials: initials(dashboard.upNext.customerName),
      customer: customerLabel(dashboard.upNext),
      detail: `${dashboard.upNext.serviceName} · ${time.format(new Date(dashboard.upNext.startsAt))} – ${time.format(new Date(dashboard.upNext.endsAt))} · with ${dashboard.upNext.therapistName}`,
      status: STATUS[dashboard.upNext.status].label,
      tone: STATUS[dashboard.upNext.status].tone,
    },
    todaysBookings: dashboard.todaysBookings.map((booking) => ({
      id: booking.id,
      time: time.format(new Date(booking.startsAt)),
      customer: customerLabel(booking),
      service: booking.serviceName,
      therapist: booking.therapistName,
      branch: booking.branchName,
      status: STATUS[booking.status].label,
      tone: STATUS[booking.status].tone,
    })),
  };
}
