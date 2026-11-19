// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type { FastifyInstance } from 'fastify';
import { jsonSchemaTransform, jsonSchemaTransformObject } from 'fastify-type-provider-zod';

/**
 * OpenAPI 3.1 document generated from the same Zod schemas that validate requests,
 * so the documentation cannot drift from the real behaviour.
 * - JSON: GET /v1/openapi.json
 * - Swagger UI: GET /v1/docs
 */
export async function registerOpenApi(app: FastifyInstance, { version }: { version: string }) {
  await app.register(swagger, {
    openapi: {
      openapi: '3.1.0',
      info: {
        title: 'Tempora API',
        description: 'Multi-tenant booking and invoicing API. Errors use RFC 9457 problem details.',
        version,
      },
      tags: [
        { name: 'system', description: 'Health and readiness' },
        {
          name: 'public',
          description: 'Portal pages before login: directory, business, availability',
        },
        {
          name: 'portal-auth',
          description: 'Customer accounts: sign-up, login, profile, sessions',
        },
        { name: 'portal-bookings', description: 'Booking and paying (customers and guests)' },
        { name: 'payments', description: 'Payment webhooks and the demo checkout' },
        { name: 'console-auth', description: 'Console sign-up, login with email code, sessions' },
        { name: 'console-branches', description: 'Branches, opening hours and closures' },
        { name: 'console-settings', description: 'Business profile and booking settings' },
        { name: 'console-services', description: 'Service catalogue' },
        { name: 'console-team', description: 'Members, roles, invitations and schedules' },
        {
          name: 'console-bookings',
          description: 'Bookings table, calendar and booking operations',
        },
      ],
    },
    transform: jsonSchemaTransform,
    transformObject: jsonSchemaTransformObject,
  });

  await app.register(swaggerUi, { routePrefix: '/v1/docs' });

  app.get('/v1/openapi.json', { schema: { hide: true } }, async () => app.swagger());
}
