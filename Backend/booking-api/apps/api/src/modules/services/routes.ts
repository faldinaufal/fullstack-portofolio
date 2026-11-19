// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import {
  CreateServiceRequestSchema,
  ServiceListSchema,
  ServiceSchema,
  UpdateServiceRequestSchema,
} from '@tempora/contracts';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { IdParams, IfMatchHeaders, problems } from '../../lib/route-schemas.js';
import type { ConsoleGuard } from '../console-auth/guard.js';
import type { ServiceCatalogue } from './service.js';

const tags = ['console-services'];

/** `/v1/console/services/*` (FSD 5.4): everyone reads, the owner edits. */
export const serviceRoutes: FastifyPluginAsyncZod<{
  service: ServiceCatalogue;
  guard: ConsoleGuard;
}> = async (app, { service, guard }) => {
  app.get(
    '/services',
    {
      preHandler: guard.require(),
      schema: {
        tags,
        summary: 'Service catalogue',
        response: { 200: ServiceListSchema, ...problems(401) },
      },
    },
    async (request) => service.list(guard.actor(request)),
  );

  app.post(
    '/services',
    {
      preHandler: guard.require('owner'),
      schema: {
        tags,
        summary: 'Create a service',
        body: CreateServiceRequestSchema,
        response: { 201: ServiceSchema, ...problems(400, 401, 403) },
      },
    },
    async (request, reply) =>
      reply.status(201).send(await service.create(guard.actor(request), request.body)),
  );

  app.patch(
    '/services/:id',
    {
      preHandler: guard.require('owner'),
      schema: {
        tags,
        summary: 'Update a service (price changes apply to new bookings only; requires If-Match)',
        params: IdParams,
        headers: IfMatchHeaders,
        body: UpdateServiceRequestSchema,
        response: { 200: ServiceSchema, ...problems(400, 401, 403, 404, 409) },
      },
    },
    async (request) =>
      service.update(
        guard.actor(request),
        request.params.id,
        request.headers['if-match'],
        request.body,
      ),
  );

  app.post(
    '/services/:id/archive',
    {
      preHandler: guard.require('owner'),
      schema: {
        tags,
        summary: 'Archive a service',
        params: IdParams,
        response: { 200: ServiceSchema, ...problems(401, 403, 404, 409) },
      },
    },
    async (request) => service.archive(guard.actor(request), request.params.id),
  );
};
