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
import { branchRoutes } from './modules/branches/routes.js';
import type { BranchService } from './modules/branches/service.js';
import { portalAuthRoutes } from './modules/portal-auth/routes.js';
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
import type { HealthRepository } from './modules/health/repository.js';
import { healthRoutes } from './modules/health/routes.js';
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
  /** Portal pages before login (`/v1/public`). */
  publicCatalogue?: PublicCatalogue;
  /** Console business modules; need `consoleAuth`. */
  consoleModules?: {
    tenant: TenantService;
    branches: BranchService;
    services: ServiceCatalogue;
    team: TeamService;
    schedules: ScheduleService;
  };
}

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;

export async function buildApp({
  env,
  healthRepository,
  consoleAuth,
  consoleModules,
  publicCatalogue,
  portalAuth,
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

  if (portalAuth) {
    await app.register(portalAuthRoutes, { prefix: '/v1/portal', ...portalAuth });
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
        }
      },
      { prefix: '/v1/console' },
    );
  }

  return app;
}

export type App = Awaited<ReturnType<typeof buildApp>>;
