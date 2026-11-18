// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { createPrismaClient, type PrismaClient } from '@tempora/db';
import type { EmailPayloads, EmailTemplate } from '@tempora/db/emails';
import type { LightMyRequestResponse } from 'fastify';
import { buildApp, type App } from '../app.js';
import { createArgon2PasswordHasher } from '../lib/passwords.js';
import { createPostgresRateLimiter } from '../lib/rate-limit.js';
import { createTokenHasher } from '../lib/tokens.js';
import { createConsoleAuthService } from '../modules/console-auth/service.js';
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
        passwords: createArgon2PasswordHasher(),
        hashToken,
        rateLimiter: createPostgresRateLimiter(prisma, hashToken, now),
        consoleUrl: 'http://localhost:3001',
        now,
      }),
      cookies: { secure: false, domain: undefined },
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
    if (csrf && !this.csrf) {
      const response = await this.get('/v1/console/auth/csrf');
      this.csrf = response.json<{ csrfToken: string }>().csrfToken;
    }
    return this.store(
      await this.app.inject({
        method: 'POST',
        url,
        headers: {
          cookie: this.cookieHeader(),
          ...(csrf && this.csrf ? { 'x-csrf-token': this.csrf } : {}),
        },
        ...(payload !== undefined && { payload }),
      }),
    );
  }
}
