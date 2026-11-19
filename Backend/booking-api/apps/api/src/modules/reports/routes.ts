// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import {
  NoShowReportSchema,
  ReportOverviewSchema,
  ReportQuerySchema,
  RevenueReportSchema,
  SeriesQuerySchema,
  ServiceReportSchema,
  UtilizationReportSchema,
} from '@tempora/contracts';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { problems } from '../../lib/route-schemas.js';
import type { ConsoleGuard } from '../console-auth/guard.js';
import type { ReportService } from './service.js';

/** `/v1/console/reports/*` (FSD 5.4 "Reporting"): owner and managers only. */
export const reportRoutes: FastifyPluginAsyncZod<{
  service: ReportService;
  guard: ConsoleGuard;
}> = async (app, { service, guard }) => {
  const leads = guard.require('owner', 'manager');
  const tags = ['console-reports'];
  const errors = problems(400, 401, 403, 404);

  app.get(
    '/reports/overview',
    {
      preHandler: leads,
      schema: {
        tags,
        summary: 'Dashboard figures (FSD 6.14)',
        querystring: ReportQuerySchema.pick({ branchId: true }),
        response: { 200: ReportOverviewSchema, ...errors },
      },
    },
    async (request) => service.overview(guard.actor(request), request.query),
  );

  app.get(
    '/reports/revenue',
    {
      preHandler: leads,
      schema: {
        tags,
        summary: 'Revenue per day, week or month, and per branch for the owner',
        querystring: SeriesQuerySchema,
        response: { 200: RevenueReportSchema, ...errors },
      },
    },
    async (request) => service.revenue(guard.actor(request), request.query),
  );

  app.get(
    '/reports/bookings-by-service',
    {
      preHandler: leads,
      schema: {
        tags,
        summary: 'Bookings and revenue per service',
        querystring: ReportQuerySchema,
        response: { 200: ServiceReportSchema, ...errors },
      },
    },
    async (request) => service.bookingsByService(guard.actor(request), request.query),
  );

  app.get(
    '/reports/utilization',
    {
      preHandler: leads,
      schema: {
        tags,
        summary: 'Booked vs. available minutes per branch and therapist',
        querystring: ReportQuerySchema,
        response: { 200: UtilizationReportSchema, ...errors },
      },
    },
    async (request) => service.utilization(guard.actor(request), request.query),
  );

  app.get(
    '/reports/no-show-rate',
    {
      preHandler: leads,
      schema: {
        tags,
        summary: 'Finished sessions and no-shows per day, week or month',
        querystring: SeriesQuerySchema,
        response: { 200: NoShowReportSchema, ...errors },
      },
    },
    async (request) => service.noShowRate(guard.actor(request), request.query),
  );
};
