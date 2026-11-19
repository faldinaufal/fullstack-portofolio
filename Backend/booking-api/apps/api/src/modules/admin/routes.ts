// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import {
  AdminOverviewSchema,
  AdminTenantDetailSchema,
  AdminTenantListQuerySchema,
  AdminTenantListSchema,
  CreateTenantRequestSchema,
  PlatformAuditListSchema,
  PlatformAuditQuerySchema,
  SuspendTenantRequestSchema,
} from '@tempora/contracts';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { IdParams, problems } from '../../lib/route-schemas.js';
import type { AdminGuard } from '../admin-auth/guard.js';
import type { AdminService } from './service.js';

/** `/v1/admin/overview`, `/tenants*` and `/audit-logs` (FSD 5.5). */
export const adminRoutes: FastifyPluginAsyncZod<{
  service: AdminService;
  guard: AdminGuard;
}> = async (app, { service, guard }) => {
  const tags = ['admin'];

  app.get(
    '/overview',
    {
      preHandler: guard.require,
      schema: {
        tags,
        summary: 'Platform metrics: tenants, daily bookings and payments, health',
        response: { 200: AdminOverviewSchema, ...problems(401) },
      },
    },
    async (request) => service.overview(guard.actor(request)),
  );

  app.get(
    '/tenants',
    {
      preHandler: guard.require,
      schema: {
        tags,
        summary: 'Tenants with status and usage; search and filter',
        querystring: AdminTenantListQuerySchema,
        response: { 200: AdminTenantListSchema, ...problems(400, 401) },
      },
    },
    async (request) => service.tenants(guard.actor(request), request.query),
  );

  app.post(
    '/tenants',
    {
      preHandler: guard.requireStepUp,
      schema: {
        tags,
        summary: 'Assisted onboarding: create a tenant and invite its owner (step-up)',
        body: CreateTenantRequestSchema,
        response: { 201: AdminTenantDetailSchema, ...problems(400, 401, 403, 409) },
      },
    },
    async (request, reply) =>
      reply.status(201).send(await service.createTenant(guard.actor(request), request.body)),
  );

  app.get(
    '/tenants/:id',
    {
      preHandler: guard.require,
      schema: {
        tags,
        summary: 'Tenant metadata, usage, owner and suspension',
        params: IdParams,
        response: { 200: AdminTenantDetailSchema, ...problems(401, 404) },
      },
    },
    async (request) => service.tenant(guard.actor(request), request.params.id),
  );

  app.post(
    '/tenants/:id/suspend',
    {
      preHandler: guard.requireStepUp,
      schema: {
        tags,
        summary: 'Suspend with a reason; the owner is emailed (step-up)',
        params: IdParams,
        body: SuspendTenantRequestSchema,
        response: { 200: AdminTenantDetailSchema, ...problems(400, 401, 403, 404) },
      },
    },
    async (request) =>
      service.suspend(guard.actor(request), request.params.id, request.body.reason),
  );

  app.post(
    '/tenants/:id/reactivate',
    {
      preHandler: guard.requireStepUp,
      schema: {
        tags,
        summary: 'Reactivate; the owner is emailed (step-up)',
        params: IdParams,
        response: { 200: AdminTenantDetailSchema, ...problems(401, 403, 404) },
      },
    },
    async (request) => service.reactivate(guard.actor(request), request.params.id),
  );

  app.get(
    '/audit-logs',
    {
      preHandler: guard.require,
      schema: {
        tags,
        summary: 'Platform-level events, newest first',
        querystring: PlatformAuditQuerySchema,
        response: { 200: PlatformAuditListSchema, ...problems(400, 401) },
      },
    },
    async (request) => service.audit(guard.actor(request), request.query),
  );
};
