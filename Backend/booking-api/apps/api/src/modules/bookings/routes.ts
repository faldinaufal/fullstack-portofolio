// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import {
  BookingCreatedSchema,
  CheckoutLinkSchema,
  CreateBookingRequestSchema,
  DemoCheckoutOutcomeSchema,
  PortalBookingDetailSchema,
  PortalBookingListQuerySchema,
  PortalBookingListSchema,
  PortalInvoiceListQuerySchema,
  PortalInvoiceListSchema,
  PortalInvoiceTotalsSchema,
  PortalInvoiceSchema,
  RescheduleRequestSchema,
  RescheduleSlotsQuerySchema,
  AvailabilitySchema,
} from '@tempora/contracts';
import type { FastifyRequest } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { NoContent, problems } from '../../lib/route-schemas.js';
import { notFound } from '../console-auth/access.js';
import type { PortalGuard } from '../portal-auth/guard.js';
import { readGuestToken, type BookingViewer } from './access.js';
import type { PortalBookingService } from './portal-service.js';
import type { BookingService } from './service.js';

const BookingParams = z.object({ id: z.uuid() });
const GuestHeader = z.object({
  authorization: z
    .string()
    .optional()
    .describe('`Guest <token>`: a booking link, instead of (or as well as) a Portal session'),
});

/** `/v1/portal/bookings*` and `/v1/portal/guest/booking` (FSD 5.3): customers and guests. */
export const bookingRoutes: FastifyPluginAsyncZod<{
  service: BookingService;
  portal: PortalBookingService;
  guard: PortalGuard;
}> = async (app, { service, portal, guard }) => {
  const viewer = (request: FastifyRequest): BookingViewer => ({
    customerAccountId: guard.customer(request)?.customerAccountId ?? null,
    guestToken: readGuestToken(request.headers.authorization),
  });

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

  app.get(
    '/bookings',
    {
      preHandler: guard.require,
      schema: {
        tags: ['portal-bookings'],
        summary: 'My bookings at every business (upcoming or past)',
        querystring: PortalBookingListQuerySchema,
        response: { 200: PortalBookingListSchema, ...problems(400, 401) },
      },
    },
    async (request) => portal.list(guard.customer(request)!.customerAccountId, request.query),
  );

  app.get(
    '/bookings/:id',
    {
      preHandler: guard.optional,
      schema: {
        tags: ['portal-bookings'],
        summary: 'One booking with its invoice, payment deadline and allowed actions',
        params: BookingParams,
        headers: GuestHeader,
        response: { 200: PortalBookingDetailSchema, ...problems(404) },
      },
    },
    async (request) => portal.detail(viewer(request), request.params.id),
  );

  app.get(
    '/guest/booking',
    {
      schema: {
        tags: ['portal-bookings'],
        summary: 'The booking a guest link belongs to (the /manage/[token] page)',
        headers: GuestHeader,
        response: { 200: PortalBookingDetailSchema, ...problems(404) },
      },
    },
    async (request) => {
      const token = readGuestToken(request.headers.authorization);
      if (!token) throw notFound('Booking');
      return portal.guestBooking(token);
    },
  );

  app.post(
    '/bookings/:id/checkout',
    {
      preHandler: guard.optional,
      schema: {
        tags: ['portal-bookings'],
        summary: 'Resume payment: the Checkout that is still open',
        params: BookingParams,
        headers: GuestHeader,
        response: { 200: CheckoutLinkSchema, ...problems(404, 409) },
      },
    },
    async (request) => portal.checkout(viewer(request), request.params.id),
  );

  app.post(
    '/bookings/:id/cancel',
    {
      preHandler: guard.optional,
      schema: {
        tags: ['portal-bookings'],
        summary: 'Cancel a booking that is still waiting for payment (the slot is free at once)',
        params: BookingParams,
        headers: GuestHeader,
        response: { 200: PortalBookingDetailSchema, ...problems(404, 409) },
      },
    },
    async (request) => portal.cancel(viewer(request), request.params.id, request.ip),
  );

  app.get(
    '/bookings/:id/reschedule-slots',
    {
      preHandler: guard.optional,
      schema: {
        tags: ['portal-bookings'],
        summary: 'Free times to move this booking to (its own time is not counted as taken)',
        params: BookingParams,
        querystring: RescheduleSlotsQuerySchema,
        headers: GuestHeader,
        response: { 200: AvailabilitySchema, ...problems(400, 404, 409) },
      },
    },
    async (request) => portal.rescheduleSlots(viewer(request), request.params.id, request.query),
  );

  app.post(
    '/bookings/:id/reschedule',
    {
      preHandler: guard.optional,
      schema: {
        tags: ['portal-bookings'],
        summary: 'Move a confirmed booking (same branch and service; therapist may change)',
        params: BookingParams,
        headers: GuestHeader,
        body: RescheduleRequestSchema,
        response: { 200: PortalBookingDetailSchema, ...problems(400, 404, 409) },
      },
    },
    async (request) =>
      portal.reschedule(viewer(request), request.params.id, request.body, request.ip),
  );

  app.get(
    '/bookings/:id/invoice',
    {
      preHandler: guard.optional,
      schema: {
        tags: ['portal-bookings'],
        summary: "The booking's invoice (same access as the booking)",
        params: BookingParams,
        headers: GuestHeader,
        response: { 200: PortalInvoiceSchema, ...problems(404) },
      },
    },
    async (request) => portal.invoice(viewer(request), request.params.id),
  );

  app.get(
    '/invoices',
    {
      preHandler: guard.require,
      schema: {
        tags: ['portal-bookings'],
        summary: 'My invoices at every business, newest first',
        querystring: PortalInvoiceListQuerySchema,
        response: { 200: PortalInvoiceListSchema, ...problems(400, 401) },
      },
    },
    async (request) => portal.invoices(guard.customer(request)!.customerAccountId, request.query),
  );

  app.get(
    '/invoices/summary',
    {
      preHandler: guard.require,
      schema: {
        tags: ['portal-bookings'],
        summary: 'Totals of my invoices: paid this year and still open',
        response: { 200: PortalInvoiceTotalsSchema, ...problems(401) },
      },
    },
    async (request) => portal.invoiceTotals(guard.customer(request)!.customerAccountId),
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
