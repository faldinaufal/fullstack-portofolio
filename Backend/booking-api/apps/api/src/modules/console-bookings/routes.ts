// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import {
  AvailabilitySchema,
  CalendarQuerySchema,
  CalendarSchema,
  ConsoleBookingDetailSchema,
  ConsoleBookingListQuerySchema,
  ConsoleBookingListSchema,
  ReassignRequestSchema,
  TeamCancelRequestSchema,
  TeamRescheduleRequestSchema,
  TeamSlotsQuerySchema,
} from '@tempora/contracts';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { IdParams, problems } from '../../lib/route-schemas.js';
import type { ConsoleGuard } from '../console-auth/guard.js';
import { sendCsv } from '../console-records/routes.js';
import type { ConsoleBookingService } from './service.js';

const tags = ['console-bookings'];

/** `/v1/console/bookings*` and `/v1/console/calendar` (FSD 5.4). */
export const consoleBookingRoutes: FastifyPluginAsyncZod<{
  service: ConsoleBookingService;
  guard: ConsoleGuard;
}> = async (app, { service, guard }) => {
  app.get(
    '/bookings',
    {
      preHandler: guard.require('owner', 'manager'),
      schema: {
        tags,
        summary: 'Bookings table: filters, sort, pagination (manager: own branch); CSV',
        querystring: ConsoleBookingListQuerySchema,
        response: { 200: ConsoleBookingListSchema, ...problems(400, 401, 403) },
      },
    },
    async (request, reply) => {
      const actor = guard.actor(request);
      if (request.query.format === 'csv') {
        return sendCsv(reply, await service.exportCsv(actor, request.query));
      }
      return service.list(actor, request.query);
    },
  );

  app.get(
    '/calendar',
    {
      preHandler: guard.require(),
      schema: {
        tags,
        summary: 'Bookings and time off of one branch for up to 14 days (staff: own column)',
        querystring: CalendarQuerySchema,
        response: { 200: CalendarSchema, ...problems(400, 401, 404) },
      },
    },
    async (request) => service.calendar(guard.actor(request), request.query),
  );

  app.get(
    '/bookings/:id',
    {
      preHandler: guard.require(),
      schema: {
        tags,
        summary: 'Booking detail with timeline and allowed actions (staff: own, limited)',
        params: IdParams,
        response: { 200: ConsoleBookingDetailSchema, ...problems(401, 404) },
      },
    },
    async (request) => service.detail(guard.actor(request), request.params.id),
  );

  app.get(
    '/bookings/:id/slots',
    {
      preHandler: guard.require('owner', 'manager'),
      schema: {
        tags,
        summary: 'Free times to move this booking to (its own time not counted as taken)',
        params: IdParams,
        querystring: TeamSlotsQuerySchema,
        response: { 200: AvailabilitySchema, ...problems(400, 401, 403, 404, 409) },
      },
    },
    async (request) => service.slots(guard.actor(request), request.params.id, request.query),
  );

  app.post(
    '/bookings/:id/reschedule',
    {
      preHandler: guard.require('owner', 'manager'),
      schema: {
        tags,
        summary: 'Move to a new time (and optionally therapist); not counted for the customer',
        params: IdParams,
        body: TeamRescheduleRequestSchema,
        response: { 200: ConsoleBookingDetailSchema, ...problems(400, 401, 403, 404, 409) },
      },
    },
    async (request) => service.reschedule(guard.actor(request), request.params.id, request.body),
  );

  app.post(
    '/bookings/:id/reassign',
    {
      preHandler: guard.require('owner', 'manager'),
      schema: {
        tags,
        summary: 'Another therapist of the branch, same time (FSD 6.6)',
        params: IdParams,
        body: ReassignRequestSchema,
        response: { 200: ConsoleBookingDetailSchema, ...problems(400, 401, 403, 404, 409) },
      },
    },
    async (request) => service.reassign(guard.actor(request), request.params.id, request.body),
  );

  app.post(
    '/bookings/:id/cancel',
    {
      preHandler: guard.require('owner', 'manager'),
      schema: {
        tags,
        summary: 'Cancel; a reason is required for a paid booking (refund outside Tempora)',
        params: IdParams,
        body: TeamCancelRequestSchema,
        response: { 200: ConsoleBookingDetailSchema, ...problems(400, 401, 403, 404, 409) },
      },
    },
    async (request) => service.cancel(guard.actor(request), request.params.id, request.body),
  );

  app.post(
    '/bookings/:id/complete',
    {
      preHandler: guard.require(),
      schema: {
        tags,
        summary: 'Mark completed (staff: own bookings)',
        params: IdParams,
        response: { 200: ConsoleBookingDetailSchema, ...problems(401, 404, 409) },
      },
    },
    async (request) => service.complete(guard.actor(request), request.params.id),
  );

  app.post(
    '/bookings/:id/no-show',
    {
      preHandler: guard.require(),
      schema: {
        tags,
        summary: 'Mark no-show (staff: own bookings)',
        params: IdParams,
        response: { 200: ConsoleBookingDetailSchema, ...problems(401, 404, 409) },
      },
    },
    async (request) => service.noShow(guard.actor(request), request.params.id),
  );
};
