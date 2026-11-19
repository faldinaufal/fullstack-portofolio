// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { createPrismaClient } from '@tempora/db';
import closeWithGrace from 'close-with-grace';
import { buildApp } from './app.js';
import { loadEnv } from './config/env.js';
import { createArgon2PasswordHasher } from './lib/passwords.js';
import { createPostgresRateLimiter } from './lib/rate-limit.js';
import { createTokenHasher } from './lib/tokens.js';
import { createBranchService } from './modules/branches/service.js';
import { createConsoleAuthService } from './modules/console-auth/service.js';
import { createPrismaHealthRepository } from './modules/health/repository.js';
import { createHmac } from 'node:crypto';
import { createDemoPaymentProvider } from './lib/payments/demo-provider.js';
import { createStripePaymentProvider } from './lib/payments/stripe-provider.js';
import { createAdminAuthService } from './modules/admin-auth/service.js';
import { createAdminService } from './modules/admin/service.js';
import { createPortalBookingService } from './modules/bookings/portal-service.js';
import { createBookingService } from './modules/bookings/service.js';
import { createPortalAuthService } from './modules/portal-auth/service.js';
import { createPublicCatalogue } from './modules/public/service.js';
import { createConsoleBookingService } from './modules/console-bookings/service.js';
import { createConsoleRecordsService } from './modules/console-records/service.js';
import { createReportService } from './modules/reports/service.js';
import { createScheduleService } from './modules/schedules/service.js';
import { createServiceCatalogue } from './modules/services/service.js';
import { createTeamService } from './modules/team/service.js';
import { createTenantService } from './modules/tenant/service.js';

const env = loadEnv();
const prisma = createPrismaClient({ connectionString: env.DATABASE_URL });

const hashToken = createTokenHasher(env.TOKEN_HASH_SECRET);
const passwords = createArgon2PasswordHasher();

// Stripe when keys are configured, otherwise the demo provider (FSD 0.2, README).
const payments =
  env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET
    ? createStripePaymentProvider({
        secretKey: env.STRIPE_SECRET_KEY,
        webhookSecret: env.STRIPE_WEBHOOK_SECRET,
      })
    : createDemoPaymentProvider({
        secret: createHmac('sha256', env.TOKEN_HASH_SECRET).update('demo-payments').digest('hex'),
        portalUrl: env.PORTAL_URL,
      });
const rateLimiter = createPostgresRateLimiter(prisma, hashToken);

const app = await buildApp({
  env,
  healthRepository: createPrismaHealthRepository(prisma),
  consoleAuth: {
    service: createConsoleAuthService({
      prisma,
      passwords,
      hashToken,
      rateLimiter,
      consoleUrl: env.CONSOLE_URL,
    }),
    cookies: { secure: env.NODE_ENV === 'production', domain: env.COOKIE_DOMAIN },
  },
  publicCatalogue: createPublicCatalogue({ prisma, timeZone: env.APP_TIME_ZONE }),
  bookings: {
    service: createBookingService({
      prisma,
      payments,
      hashToken,
      timeZone: env.APP_TIME_ZONE,
      portalUrl: env.PORTAL_URL,
    }),
    portal: createPortalBookingService({
      prisma,
      payments,
      hashToken,
      timeZone: env.APP_TIME_ZONE,
      portalUrl: env.PORTAL_URL,
    }),
  },
  admin: {
    auth: createAdminAuthService({ prisma, passwords, hashToken, rateLimiter }),
    service: createAdminService({
      prisma,
      hashToken,
      consoleUrl: env.CONSOLE_URL,
      timeZone: env.APP_TIME_ZONE,
    }),
    cookies: { secure: env.NODE_ENV === 'production', domain: env.COOKIE_DOMAIN },
  },
  portalAuth: {
    service: createPortalAuthService({
      prisma,
      passwords,
      hashToken,
      rateLimiter,
      portalUrl: env.PORTAL_URL,
    }),
    cookies: { secure: env.NODE_ENV === 'production', domain: env.COOKIE_DOMAIN },
  },
  consoleModules: {
    tenant: createTenantService({ prisma }),
    branches: createBranchService({ prisma, timeZone: env.APP_TIME_ZONE }),
    services: createServiceCatalogue({ prisma }),
    schedules: createScheduleService({ prisma, timeZone: env.APP_TIME_ZONE }),
    bookings: createConsoleBookingService({
      prisma,
      payments,
      hashToken,
      portalUrl: env.PORTAL_URL,
      timeZone: env.APP_TIME_ZONE,
    }),
    records: createConsoleRecordsService({ prisma, timeZone: env.APP_TIME_ZONE }),
    reports: createReportService({ prisma, timeZone: env.APP_TIME_ZONE }),
    team: createTeamService({
      prisma,
      passwords,
      hashToken,
      rateLimiter,
      consoleUrl: env.CONSOLE_URL,
    }),
  },
});

// Graceful shutdown (FSD 8.5): on SIGTERM during a deploy, stop accepting new requests,
// let in-flight requests finish, then close the database pool.
closeWithGrace({ delay: 10_000 }, async ({ err, signal }) => {
  if (err) app.log.error({ err }, 'Shutting down after an error');
  else app.log.info({ signal }, 'Shutting down');
  await app.close();
  await prisma.$disconnect();
});

await app.listen({ host: env.HOST, port: env.PORT });
