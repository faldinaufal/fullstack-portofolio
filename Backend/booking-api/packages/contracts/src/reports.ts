// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { z } from 'zod';
import { DateOnlySchema } from './console-branches.js';

/** Dashboard reports (FSD 5.4 "Reporting", 6.14). */

export const ReportQuerySchema = z.object({
  /** Calendar dates in the platform time zone, both included. Default: the last 30 days. */
  from: DateOnlySchema.optional(),
  to: DateOnlySchema.optional(),
  /** Owner only; a manager always gets their own branch. */
  branchId: z.uuid().optional(),
});
export type ReportQuery = z.infer<typeof ReportQuerySchema>;

export const ReportIntervalSchema = z.enum(['day', 'week', 'month']);
export type ReportInterval = z.infer<typeof ReportIntervalSchema>;

export const SeriesQuerySchema = ReportQuerySchema.extend({
  interval: ReportIntervalSchema.default('day'),
});
export type SeriesQuery = z.infer<typeof SeriesQuerySchema>;

const range = {
  from: DateOnlySchema,
  to: DateOnlySchema,
  timeZone: z.string(),
};

export const ReportOverviewSchema = z
  .object({
    today: DateOnlySchema,
    timeZone: z.string(),
    bookingsToday: z.number().int(),
    bookingsSameDayLastWeek: z.number().int(),
    revenueThisMonthCents: z.number().int(),
    revenueLastMonthCents: z.number().int(),
    /** Last 30 days, 0–1; null when nobody was available. */
    utilization: z.number().nullable(),
    /** Last 30 days, 0–1; null when no session was marked. */
    noShowRate: z.number().nullable(),
    paymentsPending: z.number().int(),
    activeTherapists: z.number().int(),
    branches: z.number().int(),
  })
  .meta({ id: 'ReportOverview' });
export type ReportOverview = z.infer<typeof ReportOverviewSchema>;

export const RevenueReportSchema = z
  .object({
    ...range,
    interval: ReportIntervalSchema,
    /** First day of each bucket (`YYYY-MM-DD`), oldest first, empty ones included. */
    buckets: z.array(z.object({ start: DateOnlySchema, cents: z.number().int() })),
    totalCents: z.number().int(),
    /** Owner's comparison across branches (empty for a manager). */
    byBranch: z.array(z.object({ id: z.uuid(), name: z.string(), cents: z.number().int() })),
  })
  .meta({ id: 'RevenueReport' });
export type RevenueReport = z.infer<typeof RevenueReportSchema>;

export const ServiceReportSchema = z
  .object({
    ...range,
    items: z.array(
      z.object({
        serviceId: z.uuid(),
        name: z.string(),
        bookings: z.number().int(),
        revenueCents: z.number().int(),
      }),
    ),
  })
  .meta({ id: 'ServiceReport' });
export type ServiceReport = z.infer<typeof ServiceReportSchema>;

const Utilization = {
  id: z.uuid(),
  name: z.string(),
  bookedMinutes: z.number().int(),
  availableMinutes: z.number().int(),
};

export const UtilizationReportSchema = z
  .object({
    ...range,
    branches: z.array(z.object(Utilization)),
    therapists: z.array(z.object({ ...Utilization, branchId: z.uuid() })),
  })
  .meta({ id: 'UtilizationReport' });
export type UtilizationReport = z.infer<typeof UtilizationReportSchema>;

export const NoShowReportSchema = z
  .object({
    ...range,
    interval: ReportIntervalSchema,
    buckets: z.array(
      z.object({ start: DateOnlySchema, finished: z.number().int(), noShows: z.number().int() }),
    ),
  })
  .meta({ id: 'NoShowReport' });
export type NoShowReport = z.infer<typeof NoShowReportSchema>;
