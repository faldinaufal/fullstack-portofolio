// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { HealthResponseSchema, ReadinessResponseSchema } from '@tempora/contracts';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import type { HealthService } from './service.js';

/** Routes translate HTTP into service calls and back; no business logic lives here. */
export const healthRoutes: FastifyPluginAsyncZod<{ service: HealthService }> = async (
  app,
  { service },
) => {
  app.get(
    '/health',
    {
      schema: {
        tags: ['system'],
        summary: 'Liveness: the API process is running',
        response: { 200: HealthResponseSchema },
      },
    },
    async () => service.getLiveness(),
  );

  app.get(
    '/health/ready',
    {
      schema: {
        tags: ['system'],
        summary: 'Readiness: database reachable and migrations applied',
        response: { 200: ReadinessResponseSchema, 503: ReadinessResponseSchema },
      },
    },
    async (_request, reply) => {
      const readiness = await service.getReadiness();
      return reply.status(readiness.status === 'ready' ? 200 : 503).send(readiness);
    },
  );
};
