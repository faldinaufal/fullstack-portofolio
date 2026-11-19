// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import {
  BookingCreatedSchema,
  CreateBookingRequestSchema,
  DemoCheckoutOutcomeSchema,
} from '@tempora/contracts';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { NoContent, problems } from '../../lib/route-schemas.js';
import type { PortalGuard } from '../portal-auth/guard.js';
import type { BookingService } from './service.js';

/** `POST /v1/portal/bookings` (FSD 5.3): customers and guests. */
export const bookingRoutes: FastifyPluginAsyncZod<{
  service: BookingService;
  guard: PortalGuard;
}> = async (app, { service, guard }) => {
  app.post(
    '/bookings',
    {
      preHandler: guard.optional,
      schema: {
        tags: ['portal-bookings'],
        summary:
          'Hold a slot, create the invoice and start Checkout (guest details when not logged in)',
        headers: z.object({
          'idempotency-key': z
            .uuid()
            .describe('Required: a retry with the same key returns the same booking'),
        }),
        body: CreateBookingRequestSchema,
        response: { 201: BookingCreatedSchema, ...problems(400, 404, 409, 422, 423, 503) },
      },
    },
    async (request, reply) =>
      reply
        .status(201)
        .send(
          await service.create(
            request.body,
            guard.customer(request),
            request.headers['idempotency-key'],
            request.ip,
          ),
        ),
  );
};

const DemoParams = z.object({ sessionId: z.string().min(8).max(80) });
const DemoQuery = z.object({ tenant: z.uuid() });

/** Webhooks and the demo checkout (FSD 5.6): no session, no CSRF; signatures instead. */
export const paymentRoutes: FastifyPluginAsyncZod<{ service: BookingService }> = async (
  app,
  { service },
) => {
  // Signatures are computed over the exact bytes the provider sent, so this scope keeps
  // JSON bodies as raw text instead of parsing them.
  await app.register(async (webhooks) => {
    webhooks.addContentTypeParser(
      'application/json',
      { parseAs: 'string' },
      (_request, body, done) => done(null, body),
    );
    webhooks.post(
      '/v1/webhooks/stripe',
      {
        schema: {
          tags: ['payments'],
          summary: 'Stripe events: Checkout completed or expired (signature verified, idempotent)',
          response: { 200: z.object({ received: z.literal(true) }), ...problems(400) },
        },
      },
      async (request) => {
        const signature = request.headers['stripe-signature'];
        await service.handleWebhook(
          String(request.body),
          typeof signature === 'string' ? signature : undefined,
        );
        return { received: true as const };
      },
    );
  });

  app.get(
    '/v1/payments/demo/:sessionId',
    {
      schema: {
        tags: ['payments'],
        summary: 'Demo checkout page details (only without Stripe keys)',
        params: DemoParams,
        querystring: DemoQuery,
        response: {
          200: z.object({
            businessName: z.string(),
            description: z.string(),
            amountCents: z.number().int(),
            status: z.string(),
            expiresAt: z.iso.datetime(),
            bookingId: z.uuid(),
          }),
          ...problems(404),
        },
      },
    },
    async (request) => service.demoCheckout(request.params.sessionId, request.query.tenant),
  );

  app.post(
    '/v1/payments/demo/:sessionId',
    {
      schema: {
        tags: ['payments'],
        summary: 'Demo checkout: pay or let it expire; emits a signed webhook event',
        params: DemoParams,
        querystring: DemoQuery,
        body: DemoCheckoutOutcomeSchema,
        response: { 204: NoContent, ...problems(400, 404) },
      },
    },
    async (request, reply) => {
      await service.completeDemoCheckout(
        request.params.sessionId,
        request.query.tenant,
        request.body.outcome,
      );
      return reply.status(204).send(null);
    },
  );
};
