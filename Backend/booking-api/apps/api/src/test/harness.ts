// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { createPrismaClient, type PrismaClient } from '@tempora/db';
import type { EmailPayloads, EmailTemplate } from '@tempora/db/emails';
import type { LightMyRequestResponse } from 'fastify';
import { buildApp, type App } from '../app.js';
import { createArgon2PasswordHasher } from '../lib/passwords.js';
import { createPostgresRateLimiter } from '../lib/rate-limit.js';
import { createTokenHasher } from '../lib/tokens.js';
import { createBranchService } from '../modules/branches/service.js';
import { createConsoleAuthService } from '../modules/console-auth/service.js';
import { createPublicCatalogue } from '../modules/public/service.js';
import { createScheduleService } from '../modules/schedules/service.js';
import { createServiceCatalogue } from '../modules/services/service.js';
import { createTeamService } from '../modules/team/service.js';
import { createTenantService } from '../modules/tenant/service.js';
import { createPrismaHealthRepository } from '../modules/health/repository.js';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value)
    throw new Error(
      `${name} must be set for integration tests (see vitest.integration.config.ts).`,
    );
  return value;
}

/** Every table the tests touch, emptied before each test. */
const TABLES = [
  'staff_time_off',
  'staff_working_hours',
  'staff_services',
  'services',
  'audit_logs',
  'invitations',
  'branch_closures',
  'branch_opening_hours',
  'rate_limit_hits',
  'email_messages',
  'auth_tokens',
  'trusted_devices',
  'otp_challenges',
  'sessions',
  'memberships',
  'branches',
  'team_accounts',
  'tenants',
];

/**
 * A real API (real routes, services and database) with a controllable clock, plus an owner
 * connection to reset tables and read rows the application role is not allowed to see.
 */
export interface Harness {
  app: App;
  /** Application-role client, the same kind the API uses (RLS enforced). */
  prisma: PrismaClient;
  /** Owner-role client: bypasses RLS. For setup and assertions only. */
  owner: PrismaClient;
  clock: { advance(ms: number): void; reset(): void };
  reset(): Promise<void>;
  close(): Promise<void>;
  /** Latest queued email of a template sent to an address. */
  lastEmail<T extends EmailTemplate>(
    to: string,
    template: T,
  ): Promise<EmailPayloads[T] | undefined>;
}

export async function createHarness(): Promise<Harness> {
  const prisma = createPrismaClient({ connectionString: requireEnv('TEST_DATABASE_URL') });
  const owner = createPrismaClient({ connectionString: requireEnv('TEST_DATABASE_OWNER_URL') });

  let offsetMs = 0;
  const now = () => new Date(Date.now() + offsetMs);
  const hashToken = createTokenHasher('integration-test-secret-0123456789abcdef');

  const passwords = createArgon2PasswordHasher();
  const rateLimiter = createPostgresRateLimiter(prisma, hashToken, now);

  const app = await buildApp({
    env: {
      LOG_LEVEL: 'silent',
      APP_VERSION: 'test',
      PORTAL_URL: 'http://localhost:3000',
      CONSOLE_URL: 'http://localhost:3001',
      ADMIN_URL: 'http://localhost:3002',
      TRUST_PROXY: false,
    },
    healthRepository: createPrismaHealthRepository(prisma),
    consoleAuth: {
      service: createConsoleAuthService({
        prisma,
        passwords,
        hashToken,
        rateLimiter,
        consoleUrl: 'http://localhost:3001',
        now,
      }),
      cookies: { secure: false, domain: undefined },
    },
    // New York observes daylight saving time, so the tests cover DST (FSD 9.2).
    publicCatalogue: createPublicCatalogue({ prisma, timeZone: 'America/New_York', now }),
    consoleModules: {
      tenant: createTenantService({ prisma }),
      branches: createBranchService({ prisma, now }),
      services: createServiceCatalogue({ prisma }),
      schedules: createScheduleService({ prisma, now }),
      team: createTeamService({
        prisma,
        passwords,
        hashToken,
        rateLimiter,
        consoleUrl: 'http://localhost:3001',
        now,
      }),
    },
  });

  return {
    app,
    prisma,
    owner,
    clock: {
      advance: (ms) => {
        offsetMs += ms;
      },
      reset: () => {
        offsetMs = 0;
      },
    },
    async reset() {
      offsetMs = 0;
      await owner.$executeRawUnsafe(`TRUNCATE ${TABLES.join(', ')} RESTART IDENTITY CASCADE`);
    },
    async close() {
      await app.close();
      await prisma.$disconnect();
      await owner.$disconnect();
    },
    async lastEmail(to, template) {
      const row = await owner.emailMessage.findFirst({
        where: { toEmail: to, template },
        orderBy: { createdAt: 'desc' },
      });
      return row?.payload as EmailPayloads[typeof template] | undefined;
    },
  };
}

/**
 * A browser-like client for one user: keeps cookies between requests and sends the CSRF
 * header on state-changing requests, like the Console app does.
 */
export class TestBrowser {
  readonly cookies = new Map<string, string>();
  private csrf: string | undefined;

  constructor(private readonly app: App) {}

  private store(response: LightMyRequestResponse) {
    for (const cookie of response.cookies as { name: string; value: string; expires?: Date }[]) {
      const expired = cookie.expires !== undefined && cookie.expires.getTime() <= Date.now();
      if (expired || cookie.value === '') this.cookies.delete(cookie.name);
      else this.cookies.set(cookie.name, cookie.value);
    }
    return response;
  }

  private cookieHeader() {
    return [...this.cookies].map(([name, value]) => `${name}=${value}`).join('; ');
  }

  async get(url: string) {
    return this.store(
      await this.app.inject({ method: 'GET', url, headers: { cookie: this.cookieHeader() } }),
    );
  }

  async post(url: string, payload?: object, { csrf = true }: { csrf?: boolean } = {}) {
    return this.request('POST', url, payload, {}, { csrf });
  }

  /** Any state-changing request: adds the CSRF header like the Console app does. */
  async request(
    method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    url: string,
    payload?: object,
    headers: Record<string, string> = {},
    { csrf = true }: { csrf?: boolean } = {},
  ) {
    if (csrf && !this.csrf) {
      const response = await this.get('/v1/console/auth/csrf');
      this.csrf = response.json<{ csrfToken: string }>().csrfToken;
    }
    return this.store(
      await this.app.inject({
        method,
        url,
        headers: {
          cookie: this.cookieHeader(),
          ...(csrf && this.csrf ? { 'x-csrf-token': this.csrf } : {}),
          ...headers,
        },
        ...(payload !== undefined && { payload }),
      }),
    );
  }
}
