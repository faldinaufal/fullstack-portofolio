// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { afterEach, describe, expect, it } from 'vitest';
import { buildApp, type App } from './app.js';
import type { HealthRepository } from './modules/health/repository.js';

const env = {
  LOG_LEVEL: 'silent',
  APP_VERSION: 'test',
  PORTAL_URL: 'http://localhost:3000',
  CONSOLE_URL: 'http://localhost:3001',
  ADMIN_URL: 'http://localhost:3002',
} as const;

const healthyRepository: HealthRepository = {
  pingDatabase: async () => {},
  countUnfinishedMigrations: async () => 0,
};

let app: App | undefined;

async function start(healthRepository: HealthRepository = healthyRepository) {
  app = await buildApp({ env, healthRepository });
  return app;
}

afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe('API app', () => {
  it('GET /health returns the liveness payload and a request ID', async () => {
    const api = await start();
    const response = await api.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: 'ok',
      service: 'tempora-api',
      version: 'test',
    });
    expect(response.headers['x-request-id']).toEqual(expect.any(String));
  });

  it('reuses a safe incoming X-Request-Id and ignores an unsafe one', async () => {
    const api = await start();

    const safe = await api.inject({
      method: 'GET',
      url: '/health',
      headers: { 'x-request-id': 'trace-123' },
    });
    expect(safe.headers['x-request-id']).toBe('trace-123');

    const unsafe = await api.inject({
      method: 'GET',
      url: '/health',
      headers: { 'x-request-id': 'bad id\nwith newline' },
    });
    expect(unsafe.headers['x-request-id']).not.toBe('bad id\nwith newline');
  });

  it('GET /health/ready returns 503 when the database is unreachable', async () => {
    const api = await start({
      pingDatabase: async () => {
        throw new Error('down');
      },
      countUnfinishedMigrations: async () => 0,
    });
    const response = await api.inject({ method: 'GET', url: '/health/ready' });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({ status: 'not_ready' });
  });

  it('answers unknown routes with an RFC 9457 problem', async () => {
    const api = await start();
    const response = await api.inject({ method: 'GET', url: '/v1/does-not-exist' });

    expect(response.statusCode).toBe(404);
    expect(response.headers['content-type']).toContain('application/problem+json');
    expect(response.json()).toMatchObject({
      type: '/problems/not-found',
      status: 404,
      code: 'NOT_FOUND',
      requestId: response.headers['x-request-id'],
    });
  });

  it('allows CORS only for the three app origins', async () => {
    const api = await start();

    const allowed = await api.inject({
      method: 'GET',
      url: '/health',
      headers: { origin: 'http://localhost:3001' },
    });
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:3001');
    expect(allowed.headers['access-control-allow-credentials']).toBe('true');

    const denied = await api.inject({
      method: 'GET',
      url: '/health',
      headers: { origin: 'https://evil.example' },
    });
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('publishes an OpenAPI document that includes the health routes', async () => {
    const api = await start();
    const response = await api.inject({ method: 'GET', url: '/v1/openapi.json' });

    expect(response.statusCode).toBe(200);
    const document = response.json<{ openapi: string; paths: Record<string, unknown> }>();
    expect(document.openapi).toBe('3.1.0');
    expect(Object.keys(document.paths)).toEqual(
      expect.arrayContaining(['/health', '/health/ready']),
    );
  });
});
