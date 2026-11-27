// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { randomUUID } from 'node:crypto';
import cookie from '@fastify/cookie';
import Fastify, { LogController } from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import type { Env } from './config/env.js';
import type { CookieSettings } from './modules/console-auth/cookies.js';
import { installConsoleGuard } from './modules/console-auth/guard.js';
import { consoleAuthRoutes } from './modules/console-auth/routes.js';
import type { ConsoleAuthService } from './modules/console-auth/service.js';
import { installAdminGuard } from './modules/admin-auth/guard.js';
import { adminAuthRoutes } from './modules/admin-auth/routes.js';
import type { AdminAuthService } from './modules/admin-auth/service.js';
import { adminRoutes } from './modules/admin/routes.js';
import type { AdminService } from './modules/admin/service.js';
import { branchRoutes } from './modules/branches/routes.js';
import { consoleBookingRoutes } from './modules/console-bookings/routes.js';
import type { ConsoleBookingService } from './modules/console-bookings/service.js';
import { consoleRecordRoutes } from './modules/console-records/routes.js';
import type { ConsoleRecordsService } from './modules/console-records/service.js';
import { consoleLogRoutes } from './modules/console-logs/routes.js';
import type { ConsoleLogService } from './modules/console-logs/service.js';
import { reportRoutes } from './modules/reports/routes.js';
import type { ReportService } from './modules/reports/service.js';
import type { BranchService } from './modules/branches/service.js';
import { installPortalGuard } from './modules/portal-auth/guard.js';
import { portalAuthRoutes } from './modules/portal-auth/routes.js';
import { bookingRoutes, paymentRoutes } from './modules/bookings/routes.js';
import type { BookingService } from './modules/bookings/service.js';
import type { PortalBookingService } from './modules/bookings/portal-service.js';
import type { PortalAuthService } from './modules/portal-auth/service.js';
import { publicRoutes } from './modules/public/routes.js';
import type { PublicCatalogue } from './modules/public/service.js';
import { scheduleRoutes } from './modules/schedules/routes.js';
import type { ScheduleService } from './modules/schedules/service.js';
import { serviceRoutes } from './modules/services/routes.js';
import type { ServiceCatalogue } from './modules/services/service.js';
import { teamRoutes } from './modules/team/routes.js';
import type { TeamService } from './modules/team/service.js';
import { tenantRoutes } from './modules/tenant/routes.js';
import type { TenantService } from './modules/tenant/service.js';
import type { SupportGrantService } from './modules/support/grants.js';
import { supportGrantRoutes, supportViewRoutes } from './modules/support/routes.js';
import type { SupportViewService } from './modules/support/views.js';
import type { HealthRepository } from './modules/health/repository.js';
import { healthRoutes } from './modules/health/routes.js';
import { demoInboxRoutes } from './modules/demo-inbox/routes.js';
import type { DemoInboxService } from './modules/demo-inbox/service.js';
import { createHealthService } from './modules/health/service.js';
import { registerErrorHandling } from './plugins/errors.js';
import { registerOpenApi } from './plugins/openapi.js';
import { registerSecurity } from './plugins/security.js';

/**
 * Everything the app needs from the outside world. `server.ts` passes real implementations;
 * tests pass fakes. This keeps the app testable without a database or network.
 */
export interface AppDependencies {
  env: Pick<
    Env,
    'LOG_LEVEL' | 'APP_VERSION' | 'PORTAL_URL' | 'CONSOLE_URL' | 'ADMIN_URL' | 'TRUST_PROXY'
  >;
  healthRepository: HealthRepository;
  /** Console authentication. Left out by tests that only exercise the app shell. */
  consoleAuth?: { service: ConsoleAuthService; cookies: CookieSettings };
  /** Customer accounts (`/v1/portal`). */
  portalAuth?: { service: PortalAuthService; cookies: CookieSettings };
  /** Booking, payments and webhooks, and the Portal's booking pages; need `portalAuth`. */
  bookings?: { service: BookingService; portal: PortalBookingService };
  /** Platform Admin (`/v1/admin`). */
  admin?: {
    auth: AdminAuthService;
    service: AdminService;
    /** Read-only support views under an owner's grant (FSD 1.4). */
    support: SupportViewService;
    cookies: CookieSettings;
  };
  /** Portal pages before login (`/v1/public`). */
  publicCatalogue?: PublicCatalogue;
  /** Public demo inbox (`/v1/public/demo-inbox`), only with DEMO_MODE on (FSD 10.3). */
  demoInbox?: DemoInboxService;
  /** Console business modules; need `consoleAuth`. */
  consoleModules?: {
    tenant: TenantService;
    branches: BranchService;
    services: ServiceCatalogue;
    team: TeamService;
    schedules: ScheduleService;
    bookings: ConsoleBookingService;
    records: ConsoleRecordsService;
    reports: ReportService;
    support: SupportGrantService;
    logs: ConsoleLogService;
  };
}

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;

export async function buildApp({
  env,
  healthRepository,
  consoleAuth,
  consoleModules,
  publicCatalogue,
  demoInbox,
  portalAuth,
  bookings,
  admin,
}: AppDependencies) {
  const app = Fastify({
    trustProxy: env.TRUST_PROXY,
    logger: {
      level: env.LOG_LEVEL,
      // Never write credentials to the logs (FSD 8.3).
      redact: {
        paths: [
          'req.headers.cookie',
          'req.headers.authorization',
          'req.headers["x-csrf-token"]',
          'res.headers["set-cookie"]',
        ],
        censor: '[redacted]',
      },
    },
    // Reuse the caller's X-Request-Id when it is safe, otherwise create one. The same ID
    // is returned in the response, attached to every log line and shown in error bodies.
    genReqId: (request) => {
      const incoming = request.headers['x-request-id'];
      return typeof incoming === 'string' && REQUEST_ID_PATTERN.test(incoming)
        ? incoming
        : randomUUID();
    },
    logController: new LogController({ requestIdLogLabel: 'requestId' }),
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.addHook('onSend', async (request, reply) => {
    reply.header('x-request-id', request.id);
  });

  registerErrorHandling(app);
  await app.register(cookie);
  await registerSecurity(app, {
    allowedOrigins: [env.PORTAL_URL, env.CONSOLE_URL, env.ADMIN_URL],
  });
  await registerOpenApi(app, { version: env.APP_VERSION });

  await app.register(healthRoutes, {
    service: createHealthService({ repository: healthRepository, version: env.APP_VERSION }),
  });

  if (publicCatalogue) {
    await app.register(publicRoutes, { prefix: '/v1/public', service: publicCatalogue });
  }

  if (demoInbox) {
    await app.register(demoInboxRoutes, { prefix: '/v1/public', service: demoInbox });
  }

  if (admin) {
    // Its own scope: Platform Admin CSRF and session checks, nothing shared with the apps.
    await app.register(
      async (scope) => {
        const guard = installAdminGuard(scope, { service: admin.auth, cookies: admin.cookies });
        await scope.register(adminAuthRoutes, {
          service: admin.auth,
          guard,
          cookies: admin.cookies,
        });
        await scope.register(adminRoutes, { service: admin.service, guard });
        await scope.register(supportViewRoutes, { service: admin.support, guard });
      },
      { prefix: '/v1/admin' },
    );
  }

  if (portalAuth) {
    // One encapsulated scope for /v1/portal: CSRF and the customer session check apply to
    // every Portal module inside it (accounts, bookings), and to nothing outside.
    await app.register(
      async (scope) => {
        const guard = installPortalGuard(scope, portalAuth);
        await scope.register(portalAuthRoutes, { ...portalAuth, guard });
        if (bookings) await scope.register(bookingRoutes, { ...bookings, guard });
      },
      { prefix: '/v1/portal' },
    );
  }
  if (bookings) {
    await app.register(paymentRoutes, { service: bookings.service });
  }

  if (consoleAuth) {
    // One encapsulated scope for /v1/console: its CSRF hook and guard apply to every
    // Console module registered inside it, and to nothing outside.
    await app.register(
      async (scope) => {
        const guard = installConsoleGuard(scope, consoleAuth);
        await scope.register(consoleAuthRoutes, { ...consoleAuth, guard });
        if (consoleModules) {
          await scope.register(branchRoutes, { service: consoleModules.branches, guard });
          await scope.register(tenantRoutes, { service: consoleModules.tenant, guard });
          await scope.register(serviceRoutes, { service: consoleModules.services, guard });
          await scope.register(teamRoutes, { service: consoleModules.team, guard });
          await scope.register(scheduleRoutes, { service: consoleModules.schedules, guard });
          await scope.register(consoleBookingRoutes, { service: consoleModules.bookings, guard });
          await scope.register(consoleRecordRoutes, { service: consoleModules.records, guard });
          await scope.register(reportRoutes, { service: consoleModules.reports, guard });
          await scope.register(supportGrantRoutes, { service: consoleModules.support, guard });
          await scope.register(consoleLogRoutes, { service: consoleModules.logs, guard });
        }
      },
      { prefix: '/v1/console' },
    );
  }

  return app;
}

export type App = Awaited<ReturnType<typeof buildApp>>;
