import { describe, expect, it } from 'vitest';
import type { HealthRepository } from './repository.js';
import { createHealthService } from './service.js';

function fakeRepository(overrides: Partial<HealthRepository> = {}): HealthRepository {
  return {
    pingDatabase: async () => {},
    countUnfinishedMigrations: async () => 0,
    ...overrides,
  };
}

const fixedNow = () => new Date('2026-11-18T09:30:00.000Z');

describe('health service', () => {
  it('reports liveness without touching the database', () => {
    let touched = false;
    const service = createHealthService({
      repository: fakeRepository({
        pingDatabase: async () => {
          touched = true;
        },
      }),
      version: '1.2.3',
      now: fixedNow,
    });

    expect(service.getLiveness()).toEqual({
      status: 'ok',
      service: 'tempora-api',
      version: '1.2.3',
      time: '2026-11-18T09:30:00.000Z',
    });
    expect(touched).toBe(false);
  });

  it('is ready when the database answers and all migrations finished', async () => {
    const service = createHealthService({ repository: fakeRepository(), version: 'dev' });

    await expect(service.getReadiness()).resolves.toEqual({
      status: 'ready',
      checks: [
        { name: 'database', ok: true },
        { name: 'migrations', ok: true },
      ],
    });
  });

  it('is not ready and skips the migration check when the database is down', async () => {
    const service = createHealthService({
      repository: fakeRepository({
        pingDatabase: async () => {
          throw new Error('connection refused');
        },
      }),
      version: 'dev',
    });

    await expect(service.getReadiness()).resolves.toEqual({
      status: 'not_ready',
      checks: [{ name: 'database', ok: false, detail: 'Database unreachable' }],
    });
  });

  it('is not ready while a migration is unfinished', async () => {
    const service = createHealthService({
      repository: fakeRepository({ countUnfinishedMigrations: async () => 1 }),
      version: 'dev',
    });

    const readiness = await service.getReadiness();
    expect(readiness.status).toBe('not_ready');
    expect(readiness.checks[1]).toEqual({
      name: 'migrations',
      ok: false,
      detail: '1 migration(s) not finished',
    });
  });
});
