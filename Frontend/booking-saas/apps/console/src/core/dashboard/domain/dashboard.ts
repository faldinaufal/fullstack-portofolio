// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

/**
 * The owner's and manager's dashboard (FSD 2.2 Dashboard, 6.14): the figures and series of
 * the reports API, plus the rules the screen applies to them.
 */

export type ReportInterval = 'day' | 'week' | 'month';

export interface Overview {
  today: string;
  timeZone: string;
  bookingsToday: number;
  bookingsSameDayLastWeek: number;
  revenueThisMonthCents: number;
  revenueLastMonthCents: number;
  /** 0–1, null when nobody was available. */
  utilization: number | null;
  /** 0–1, null when no session was marked. */
  noShowRate: number | null;
  paymentsPending: number;
  activeTherapists: number;
  branches: number;
}

export interface RevenueSeries {
  interval: ReportInterval;
  timeZone: string;
  buckets: { start: string; cents: number }[];
  totalCents: number;
  /** The owner's comparison across branches; empty for a manager or one branch. */
  byBranch: { id: string; name: string; cents: number }[];
}

export interface ServiceStat {
  serviceId: string;
  name: string;
  bookings: number;
  revenueCents: number;
}

export interface UtilizationRow {
  id: string;
  name: string;
  bookedMinutes: number;
  availableMinutes: number;
}

export interface UtilizationReport {
  branches: UtilizationRow[];
  therapists: (UtilizationRow & { branchId: string })[];
}

export interface NoShowSeries {
  interval: ReportInterval;
  buckets: { start: string; finished: number; noShows: number }[];
}

/** The period and scope every chart of the dashboard shows. */
export interface DashboardRange {
  from: string;
  to: string;
  interval: ReportInterval;
  /** Owner only; undefined = every branch. */
  branchId?: string | undefined;
}

/** Implemented by the data layer; failures are `RequestError`s. */
export interface DashboardRepository {
  overview(branchId: string | undefined): Promise<Overview>;
  revenue(range: DashboardRange): Promise<RevenueSeries>;
  services(range: DashboardRange): Promise<ServiceStat[]>;
  utilization(range: DashboardRange): Promise<UtilizationReport>;
  noShows(range: DashboardRange): Promise<NoShowSeries>;
}

export type DashboardPreset = '7d' | '30d' | '90d' | '12m';

const addDays = (date: string, days: number) => {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/**
 * The dates and bucket size of a preset, ending today: daily bars for a week or a month,
 * weekly for a quarter, monthly for a year (12 whole months, this one included).
 */
export function presetRange(
  preset: DashboardPreset,
  today: string,
): Omit<DashboardRange, 'branchId'> {
  switch (preset) {
    case '7d':
      return { from: addDays(today, -6), to: today, interval: 'day' };
    case '30d':
      return { from: addDays(today, -29), to: today, interval: 'day' };
    case '90d':
      return { from: addDays(today, -89), to: today, interval: 'week' };
    case '12m': {
      const [year, month] = today.split('-').map(Number);
      const start = new Date(Date.UTC(year!, month! - 1 - 11, 1));
      return { from: start.toISOString().slice(0, 10), to: today, interval: 'month' };
    }
  }
}

/** Change from `previous` to `current` as a share (0.25 = +25 %); null without a base. */
export function change(current: number, previous: number): number | null {
  return previous > 0 ? (current - previous) / previous : null;
}

/** Booked share of the available time, 0–1; null when nobody was available. */
export const utilizationOf = (row: Pick<UtilizationRow, 'bookedMinutes' | 'availableMinutes'>) =>
  row.availableMinutes > 0 ? row.bookedMinutes / row.availableMinutes : null;

/** No-show share of a bucket, or null when nothing was marked (a gap, not a zero). */
export const noShowShare = (bucket: { finished: number; noShows: number }) =>
  bucket.finished > 0 ? bucket.noShows / bucket.finished : null;

/**
 * "Up next": the first of today's bookings that still needs the business (confirmed or
 * awaiting payment) and has not started yet.
 */
export function upNext<T extends { startsAt: Date; status: string }>(
  rows: T[],
  now: Date,
): T | null {
  return (
    [...rows]
      .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
      .find(
        (row) =>
          (row.status === 'confirmed' || row.status === 'pending_payment') &&
          row.startsAt.getTime() > now.getTime(),
      ) ?? null
  );
}
