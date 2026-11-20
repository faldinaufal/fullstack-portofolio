// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import {
  ConsoleBookingDetailSchema,
  ConsoleBookingListSchema,
  ConsoleCustomerDetailSchema,
  ConsoleInvoiceDetailSchema,
  CreateSupportGrantRequestSchema,
  CustomerListSchema,
  InvoiceListSchema,
  SupportBookingQuerySchema,
  SupportCustomerQuerySchema,
  SupportGrantListSchema,
  SupportInvoiceQuerySchema,
} from '@tempora/contracts';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { IdParams, problems } from '../../lib/route-schemas.js';
import type { AdminGuard } from '../admin-auth/guard.js';
import type { ConsoleGuard } from '../console-auth/guard.js';
import type { SupportGrantService } from './grants.js';
import type { SupportViewService } from './views.js';

/** `/v1/console/support-grants*` (FSD 5.4): the owner grants and revokes support access. */
export const supportGrantRoutes: FastifyPluginAsyncZod<{
  service: SupportGrantService;
  guard: ConsoleGuard;
}> = async (app, { service, guard }) => {
  const tags = ['console-settings'];
  const owner = guard.require('owner');

  app.get(
    '/support-grants',
    {
      preHandler: owner,
      schema: {
        tags,
        summary: 'The active support grant and the latest ones',
        response: { 200: SupportGrantListSchema, ...problems(401, 403) },
      },
    },
    async (request) => service.list(guard.actor(request)),
  );

  app.post(
    '/support-grants',
    {
      preHandler: owner,
      schema: {
        tags,
        summary: 'Grant support access for 1, 24 or 72 hours (replaces an active grant)',
        body: CreateSupportGrantRequestSchema,
        response: { 201: SupportGrantListSchema, ...problems(400, 401, 403) },
      },
    },
    async (request, reply) =>
      reply.status(201).send(await service.grant(guard.actor(request), request.body.durationHours)),
  );

  app.delete(
    '/support-grants/:id',
    {
      preHandler: owner,
      schema: {
        tags,
        summary: 'Revoke a support grant now',
        params: IdParams,
        response: { 200: SupportGrantListSchema, ...problems(401, 403, 404) },
      },
    },
    async (request) => service.revoke(guard.actor(request), request.params.id),
  );
};

const RecordParams = z.object({ id: z.uuid(), recordId: z.uuid() });

/**
 * `/v1/admin/tenants/:id/support/*` (FSD 5.5): read-only views under the owner's grant. Each
 * call needs a fresh step-up (FSD 6.11) and is logged in the tenant's audit log.
 */
export const supportViewRoutes: FastifyPluginAsyncZod<{
  service: SupportViewService;
  guard: AdminGuard;
}> = async (app, { service, guard }) => {
  const tags = ['admin-support'];
  const errors = problems(400, 401, 403, 404);

  // Customer data: never kept in a shared or browser cache.
  app.addHook('onSend', async (_request, reply) => {
    reply.header('cache-control', 'no-store');
  });

  app.get(
    '/tenants/:id/support/bookings',
    {
      preHandler: guard.requireStepUp,
      schema: {
        tags,
        summary: "The tenant's bookings (support, read only)",
        params: IdParams,
        querystring: SupportBookingQuerySchema,
        response: { 200: ConsoleBookingListSchema, ...errors },
      },
    },
    async (request) => service.bookings(guard.actor(request), request.params.id, request.query),
  );

  app.get(
    '/tenants/:id/support/bookings/:recordId',
    {
      preHandler: guard.requireStepUp,
      schema: {
        tags,
        summary: 'One booking (support, read only)',
        params: RecordParams,
        response: { 200: ConsoleBookingDetailSchema, ...errors },
      },
    },
    async (request) =>
      service.booking(guard.actor(request), request.params.id, request.params.recordId),
  );

  app.get(
    '/tenants/:id/support/customers',
    {
      preHandler: guard.requireStepUp,
      schema: {
        tags,
        summary: "The tenant's customers (support, read only)",
        params: IdParams,
        querystring: SupportCustomerQuerySchema,
        response: { 200: CustomerListSchema, ...errors },
      },
    },
    async (request) => service.customers(guard.actor(request), request.params.id, request.query),
  );

  app.get(
    '/tenants/:id/support/customers/:recordId',
    {
      preHandler: guard.requireStepUp,
      schema: {
        tags,
        summary: 'One customer with their bookings (support, read only)',
        params: RecordParams,
        response: { 200: ConsoleCustomerDetailSchema, ...errors },
      },
    },
    async (request) =>
      service.customer(guard.actor(request), request.params.id, request.params.recordId),
  );

  app.get(
    '/tenants/:id/support/invoices',
    {
      preHandler: guard.requireStepUp,
      schema: {
        tags,
        summary: "The tenant's invoices (support, read only)",
        params: IdParams,
        querystring: SupportInvoiceQuerySchema,
        response: { 200: InvoiceListSchema, ...errors },
      },
    },
    async (request) => service.invoices(guard.actor(request), request.params.id, request.query),
  );

  app.get(
    '/tenants/:id/support/invoices/:recordId',
    {
      preHandler: guard.requireStepUp,
      schema: {
        tags,
        summary: 'One invoice with its payments (support, read only)',
        params: RecordParams,
        response: { 200: ConsoleInvoiceDetailSchema, ...errors },
      },
    },
    async (request) =>
      service.invoice(guard.actor(request), request.params.id, request.params.recordId),
  );
};
