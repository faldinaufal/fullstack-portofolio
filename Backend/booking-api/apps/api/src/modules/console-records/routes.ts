// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import {
  ConsoleCustomerDetailSchema,
  ConsoleInvoiceDetailSchema,
  CustomerListQuerySchema,
  CustomerListSchema,
  CustomerSummarySchema,
  InvoiceListQuerySchema,
  InvoiceListSchema,
} from '@tempora/contracts';
import type { FastifyReply } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import type { Readable } from 'node:stream';
import { IdParams, problems } from '../../lib/route-schemas.js';
import type { ConsoleGuard } from '../console-auth/guard.js';
import type { ConsoleRecordsService } from './service.js';

/**
 * Sends a CSV download (FSD 5.1). The stream bypasses the JSON response schema; the
 * `Cache-Control` keeps customer data out of shared caches.
 */
export function sendCsv(reply: FastifyReply, file: { fileName: string; stream: Readable }) {
  return reply
    .header('content-type', 'text/csv; charset=utf-8')
    .header('content-disposition', `attachment; filename="${file.fileName}"`)
    .header('cache-control', 'no-store')
    .send(file.stream as never);
}

/** `/v1/console/customers*` and `/v1/console/invoices*` (FSD 5.4). */
export const consoleRecordRoutes: FastifyPluginAsyncZod<{
  service: ConsoleRecordsService;
  guard: ConsoleGuard;
}> = async (app, { service, guard }) => {
  const leads = guard.require('owner', 'manager');

  app.get(
    '/customers',
    {
      preHandler: leads,
      schema: {
        tags: ['console-customers'],
        summary: 'Customers with booking figures (manager: who booked at own branch); CSV',
        querystring: CustomerListQuerySchema,
        response: { 200: CustomerListSchema, ...problems(400, 401, 403) },
      },
    },
    async (request, reply) => {
      const actor = guard.actor(request);
      if (request.query.format === 'csv') {
        return sendCsv(reply, await service.exportCustomers(actor, request.query));
      }
      return service.customers(actor, request.query);
    },
  );

  app.get(
    '/customers/summary',
    {
      preHandler: leads,
      schema: {
        tags: ['console-customers'],
        summary: 'Figures for the Customers page, in the same scope as the list',
        response: { 200: CustomerSummarySchema, ...problems(401, 403) },
      },
    },
    async (request) => service.customerSummary(guard.actor(request)),
  );

  app.get(
    '/customers/:id',
    {
      preHandler: leads,
      schema: {
        tags: ['console-customers'],
        summary: 'Customer detail with their bookings at this business',
        params: IdParams,
        response: { 200: ConsoleCustomerDetailSchema, ...problems(401, 403, 404) },
      },
    },
    async (request) => service.customer(guard.actor(request), request.params.id),
  );

  app.get(
    '/invoices',
    {
      preHandler: leads,
      schema: {
        tags: ['console-invoices'],
        summary: 'Invoices with filters (manager: own branch); CSV',
        querystring: InvoiceListQuerySchema,
        response: { 200: InvoiceListSchema, ...problems(400, 401, 403) },
      },
    },
    async (request, reply) => {
      const actor = guard.actor(request);
      if (request.query.format === 'csv') {
        return sendCsv(reply, await service.exportInvoices(actor, request.query));
      }
      return service.invoices(actor, request.query);
    },
  );

  app.get(
    '/invoices/:id',
    {
      preHandler: leads,
      schema: {
        tags: ['console-invoices'],
        summary: 'Invoice detail with the booking, customer and payment attempts',
        params: IdParams,
        response: { 200: ConsoleInvoiceDetailSchema, ...problems(401, 403, 404) },
      },
    },
    async (request) => service.invoice(guard.actor(request), request.params.id),
  );
};
