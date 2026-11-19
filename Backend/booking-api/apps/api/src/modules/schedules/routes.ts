// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import {
  CreateTimeOffRequestSchema,
  MemberDetailSchema,
  ReplaceMemberServicesRequestSchema,
  ReplaceWorkingHoursRequestSchema,
  TimeOffListSchema,
  TimeOffSchema,
} from '@tempora/contracts';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { IdParams, NoContent, problems } from '../../lib/route-schemas.js';
import type { ConsoleGuard } from '../console-auth/guard.js';
import type { ScheduleService } from './service.js';

const tags = ['console-team'];
const TimeOffParams = z.object({ id: z.uuid(), timeOffId: z.uuid() });

/** `/v1/console/members/:id` detail and schedule routes (FSD 5.4 Team). */
export const scheduleRoutes: FastifyPluginAsyncZod<{
  service: ScheduleService;
  guard: ConsoleGuard;
}> = async (app, { service, guard }) => {
  app.get(
    '/members/:id',
    {
      preHandler: guard.require(),
      schema: {
        tags,
        summary: 'Member detail: working hours, services, time off (staff: self only)',
        params: IdParams,
        response: { 200: MemberDetailSchema, ...problems(401, 404) },
      },
    },
    async (request) => service.getMember(guard.actor(request), request.params.id),
  );

  app.put(
    '/members/:id/working-hours',
    {
      preHandler: guard.require('owner', 'manager'),
      schema: {
        tags,
        summary: 'Replace weekly working hours (within branch opening hours)',
        params: IdParams,
        body: ReplaceWorkingHoursRequestSchema,
        response: { 200: MemberDetailSchema, ...problems(400, 401, 403, 404, 409) },
      },
    },
    async (request) =>
      service.replaceWorkingHours(guard.actor(request), request.params.id, request.body.hours),
  );

  app.put(
    '/members/:id/services',
    {
      preHandler: guard.require('owner', 'manager'),
      schema: {
        tags,
        summary: 'Replace the services the therapist performs',
        params: IdParams,
        body: ReplaceMemberServicesRequestSchema,
        response: { 200: MemberDetailSchema, ...problems(400, 401, 403, 404, 409) },
      },
    },
    async (request) =>
      service.replaceServices(guard.actor(request), request.params.id, request.body.serviceIds),
  );

  app.get(
    '/members/:id/time-off',
    {
      preHandler: guard.require(),
      schema: {
        tags,
        summary: 'Upcoming time off (staff: self)',
        params: IdParams,
        response: { 200: TimeOffListSchema, ...problems(401, 404) },
      },
    },
    async (request) => service.listTimeOff(guard.actor(request), request.params.id),
  );

  app.post(
    '/members/:id/time-off',
    {
      preHandler: guard.require(),
      schema: {
        tags,
        summary: 'Add time off (staff: self)',
        params: IdParams,
        body: CreateTimeOffRequestSchema,
        response: { 201: TimeOffSchema, ...problems(400, 401, 403, 404, 409) },
      },
    },
    async (request, reply) =>
      reply
        .status(201)
        .send(await service.addTimeOff(guard.actor(request), request.params.id, request.body)),
  );

  app.delete(
    '/members/:id/time-off/:timeOffId',
    {
      preHandler: guard.require(),
      schema: {
        tags,
        summary: 'Remove time off (staff: self)',
        params: TimeOffParams,
        response: { 204: NoContent, ...problems(401, 403, 404) },
      },
    },
    async (request, reply) => {
      await service.removeTimeOff(
        guard.actor(request),
        request.params.id,
        request.params.timeOffId,
      );
      return reply.status(204).send(null);
    },
  );
};
