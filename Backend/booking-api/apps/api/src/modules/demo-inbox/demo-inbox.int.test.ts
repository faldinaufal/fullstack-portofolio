// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { createPrismaClient } from '@tempora/db';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../app.js';
import { createPrismaHealthRepository } from '../health/repository.js';
import { createPrismaDemoInboxRepository } from './repository.js';
import { createDemoInboxService } from './service.js';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} must be set for integration tests.`);
  return value;
}

const DOMAIN = 'demo.tempora.test';
// The API's own role: it may read the demo inbox and nothing more.
const prisma = createPrismaClient({ connectionString: requireEnv('TEST_DATABASE_URL') });
// Owner: writes fixtures, the way the worker would.
const owner = createPrismaClient({ connectionString: requireEnv('TEST_DATABASE_OWNER_URL') });

const env = {
  LOG_LEVEL: 'silent',
  APP_VERSION: 'test',
  PORTAL_URL: 'http://localhost:3000',
  CONSOLE_URL: 'http://localhost:3001',
  ADMIN_URL: 'http://localhost:3002',
  TRUST_PROXY: false,
} as const;
const healthRepository = createPrismaHealthRepository(prisma);

const demoApp = await buildApp({
  env,
  healthRepository,
  demoInbox: createDemoInboxService({
    repository: createPrismaDemoInboxRepository(prisma),
    domain: DOMAIN,
  }),
});
const plainApp = await buildApp({ env, healthRepository });

afterAll(async () => {
  await demoApp.close();
  await plainApp.close();
  await prisma.$disconnect();
  await owner.$disconnect();
});

beforeEach(async () => {
  await owner.$executeRaw`TRUNCATE demo_emails`;
});

async function store(to: string, subject: string, minutesAgo: number) {
  await owner.demoEmail.create({
    data: {
      toEmail: to,
      template: 'console.login_code',
      subject,
      textBody: `Body of ${subject}`,
      createdAt: new Date(Date.now() - minutesAgo * 60_000),
    },
  });
}

describe('GET /v1/public/demo-inbox (FSD 5.2, 10.3)', () => {
  it('lists the newest demo emails first, filtered by address, never cached', async () => {
    await store(`owner@${DOMAIN}`, '111111 is your Tempora Console code', 3);
    await store(`manager@${DOMAIN}`, '222222 is your Tempora Console code', 2);
    await store(`owner@${DOMAIN}`, '333333 is your Tempora Console code', 1);
    await store(`owner@${DOMAIN}`, 'Older than a day', 25 * 60);

    const all = await demoApp.inject({ method: 'GET', url: '/v1/public/demo-inbox' });
    expect(all.statusCode).toBe(200);
    expect(all.headers['cache-control']).toBe('no-store');
    const body = all.json<{ domain: string; items: { to: string; subject: string }[] }>();
    expect(body.domain).toBe(DOMAIN);
    expect(body.items.map((e) => e.subject.slice(0, 6))).toEqual(['333333', '222222', '111111']);

    const owners = await demoApp.inject({
      method: 'GET',
      url: `/v1/public/demo-inbox?to=${encodeURIComponent(`Owner@${DOMAIN}`)}`,
    });
    expect(owners.json<{ items: { to: string }[] }>().items.map((e) => e.to)).toEqual([
      `owner@${DOMAIN}`,
      `owner@${DOMAIN}`,
    ]);
  });

  it('refuses an address outside the demo domain', async () => {
    const response = await demoApp.inject({
      method: 'GET',
      url: '/v1/public/demo-inbox?to=someone%40example.com',
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: 'VALIDATION_FAILED' });
  });

  it('does not exist without DEMO_MODE', async () => {
    const response = await plainApp.inject({ method: 'GET', url: '/v1/public/demo-inbox' });
    expect(response.statusCode).toBe(404);
  });

  it('is read-only for the API role', async () => {
    await expect(
      prisma.demoEmail.create({
        data: { toEmail: `x@${DOMAIN}`, template: 't', subject: 's', textBody: 'b' },
      }),
    ).rejects.toThrow(/permission denied/);
    await expect(prisma.$executeRaw`DELETE FROM demo_emails`).rejects.toThrow(/permission denied/);
  });
});
