// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import {
  AuditLogPageSchema,
  AuditLogQuerySchema,
  EmailLogPageSchema,
  EmailLogQuerySchema,
} from '@tempora/contracts';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { problems } from '../../lib/route-schemas.js';
import type { ConsoleGuard } from '../console-auth/guard.js';
import { sendCsv } from '../console-records/routes.js';
import type { ConsoleLogService } from './service.js';

/** `/v1/console/audit-logs` and `/v1/console/emails` (FSD 5.4): owner and managers. */
export const consoleLogRoutes: FastifyPluginAsyncZod<{
  service: ConsoleLogService;
  guard: ConsoleGuard;
}> = async (app, { service, guard }) => {
  const leads = guard.require('owner', 'manager');

  app.get(
    '/audit-logs',
    {
      preHandler: leads,
      schema: {
        tags: ['console-logs'],
        summary: 'Audit log, newest first (manager: own branch); cursor pages; CSV',
        querystring: AuditLogQuerySchema,
        response: { 200: AuditLogPageSchema, ...problems(400, 401, 403) },
      },
    },
    async (request, reply) => {
      const actor = guard.actor(request);
      if (request.query.format === 'csv') {
        return sendCsv(reply, await service.exportAudit(actor, request.query));
      }
      return service.audit(actor, request.query);
    },
  );

  app.get(
    '/emails',
    {
      preHandler: leads,
      schema: {
        tags: ['console-logs'],
        summary: 'Email delivery log (manager: emails about own branch bookings)',
        querystring: EmailLogQuerySchema,
        response: { 200: EmailLogPageSchema, ...problems(400, 401, 403) },
      },
    },
    async (request) => service.emails(guard.actor(request), request.query),
  );
};
