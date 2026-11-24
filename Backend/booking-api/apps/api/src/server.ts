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
import { createS3Storage } from './lib/storage/s3-storage.js';
import { createAdminAuthService } from './modules/admin-auth/service.js';
import { createAdminService } from './modules/admin/service.js';
import { createPortalBookingService } from './modules/bookings/portal-service.js';
import { createBookingService } from './modules/bookings/service.js';
import { createPortalAuthService } from './modules/portal-auth/service.js';
import { createPublicCatalogue } from './modules/public/service.js';
import { createConsoleBookingService } from './modules/console-bookings/service.js';
import { createConsoleRecordsService } from './modules/console-records/service.js';
import { createConsoleLogService } from './modules/console-logs/service.js';
import { createSupportGrantService } from './modules/support/grants.js';
import { createSupportViewService } from './modules/support/views.js';
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
// Object storage for business images (FSD 6.15); without it, uploads are unavailable.
const storage =
  env.S3_ENDPOINT &&
  env.S3_BUCKET &&
  env.S3_ACCESS_KEY_ID &&
  env.S3_SECRET_ACCESS_KEY &&
  env.S3_PUBLIC_BASE_URL
    ? createS3Storage({
        endpoint: env.S3_ENDPOINT,
        ...(env.S3_UPLOAD_ENDPOINT && { uploadEndpoint: env.S3_UPLOAD_ENDPOINT }),
        region: env.S3_REGION,
        bucket: env.S3_BUCKET,
        accessKeyId: env.S3_ACCESS_KEY_ID,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY,
        publicBaseUrl: env.S3_PUBLIC_BASE_URL,
      })
    : null;
const rateLimiter = createPostgresRateLimiter(prisma, hashToken);
// Shared by the Console and the Platform Admin's support views (same queries, FSD 1.4).
const consoleBookings = createConsoleBookingService({
  prisma,
  payments,
  hashToken,
  portalUrl: env.PORTAL_URL,
  timeZone: env.APP_TIME_ZONE,
});
const consoleRecords = createConsoleRecordsService({ prisma, timeZone: env.APP_TIME_ZONE });

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
  publicCatalogue: createPublicCatalogue({ prisma, timeZone: env.APP_TIME_ZONE, storage }),
  bookings: {
    service: createBookingService({
      prisma,
      payments,
      hashToken,
      timeZone: env.APP_TIME_ZONE,
      portalUrl: env.PORTAL_URL,
      storage,
    }),
    portal: createPortalBookingService({
      prisma,
      payments,
      hashToken,
      timeZone: env.APP_TIME_ZONE,
      portalUrl: env.PORTAL_URL,
      storage,
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
    support: createSupportViewService({
      prisma,
      bookings: consoleBookings,
      records: consoleRecords,
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
    tenant: createTenantService({ prisma, storage }),
    branches: createBranchService({ prisma, timeZone: env.APP_TIME_ZONE }),
    services: createServiceCatalogue({ prisma }),
    schedules: createScheduleService({ prisma, timeZone: env.APP_TIME_ZONE, storage }),
    bookings: consoleBookings,
    records: consoleRecords,
    reports: createReportService({ prisma, timeZone: env.APP_TIME_ZONE }),
    support: createSupportGrantService({ prisma }),
    logs: createConsoleLogService({ prisma, timeZone: env.APP_TIME_ZONE }),
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
