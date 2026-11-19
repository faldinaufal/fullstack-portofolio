// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { TenantSettingsSchema, UpdateTenantRequestSchema } from '@tempora/contracts';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { IfMatchHeaders, problems } from '../../lib/route-schemas.js';
import type { ConsoleGuard } from '../console-auth/guard.js';
import type { TenantService } from './service.js';

const tags = ['console-settings'];

/** `/v1/console/tenant` (FSD 5.4 Tenant & settings). */
export const tenantRoutes: FastifyPluginAsyncZod<{
  service: TenantService;
  guard: ConsoleGuard;
}> = async (app, { service, guard }) => {
  app.get(
    '/tenant',
    {
      preHandler: guard.require('owner', 'manager'),
      schema: {
        tags,
        summary: 'Business profile, booking settings and setup status',
        response: { 200: TenantSettingsSchema, ...problems(401, 403) },
      },
    },
    async (request) => service.get(guard.actor(request)),
  );

  app.patch(
    '/tenant',
    {
      preHandler: guard.require('owner'),
      schema: {
        tags,
        summary: 'Update business name and booking settings (requires If-Match)',
        headers: IfMatchHeaders,
        body: UpdateTenantRequestSchema,
        response: { 200: TenantSettingsSchema, ...problems(400, 401, 403, 409) },
      },
    },
    async (request) =>
      service.update(guard.actor(request), request.headers['if-match'], request.body),
  );
};
