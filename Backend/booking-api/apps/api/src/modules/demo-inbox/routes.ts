// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { DemoInboxQuerySchema, DemoInboxSchema } from '@tempora/contracts';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { problems } from '../../lib/route-schemas.js';
import type { DemoInboxService } from './service.js';

/** `GET /v1/public/demo-inbox` (FSD 5.2): registered only with DEMO_MODE on. */
export const demoInboxRoutes: FastifyPluginAsyncZod<{ service: DemoInboxService }> = async (
  app,
  { service },
) => {
  app.get(
    '/demo-inbox',
    {
      schema: {
        tags: ['public'],
        summary: 'Public demo inbox: the newest emails to demo addresses (DEMO_MODE only)',
        querystring: DemoInboxQuerySchema,
        response: { 200: DemoInboxSchema, ...problems(400) },
      },
    },
    async (request, reply) => {
      // Codes arrive within seconds; a cached copy would hide them.
      reply.header('Cache-Control', 'no-store');
      return service.list(request.query.to);
    },
  );
};
