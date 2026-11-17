import type { HealthResponse, ReadinessCheck, ReadinessResponse } from '@tempora/contracts';
import type { HealthRepository } from './repository.js';

export interface HealthServiceDependencies {
  repository: HealthRepository;
  version: string;
  now?: () => Date;
}

/**
 * Liveness answers "is the process running?" and never touches the database,
 * so a slow database does not make the platform restart a healthy container.
 * Readiness answers "can this instance serve traffic?" and checks its dependencies;
 * the platform only routes traffic to an instance once it reports ready.
 */
export function createHealthService({
  repository,
  version,
  now = () => new Date(),
}: HealthServiceDependencies) {
  async function checkDatabase(): Promise<ReadinessCheck> {
    try {
      await repository.pingDatabase();
      return { name: 'database', ok: true };
    } catch {
      return { name: 'database', ok: false, detail: 'Database unreachable' };
    }
  }

  async function checkMigrations(): Promise<ReadinessCheck> {
    try {
      const unfinished = await repository.countUnfinishedMigrations();
      return unfinished === 0
        ? { name: 'migrations', ok: true }
        : { name: 'migrations', ok: false, detail: `${unfinished} migration(s) not finished` };
    } catch {
      return { name: 'migrations', ok: false, detail: 'Migration history not readable' };
    }
  }

  return {
    getLiveness(): HealthResponse {
      return { status: 'ok', service: 'tempora-api', version, time: now().toISOString() };
    },

    async getReadiness(): Promise<ReadinessResponse> {
      const database = await checkDatabase();
      // Without a database there is nothing more to check.
      const checks = database.ok ? [database, await checkMigrations()] : [database];
      return {
        status: checks.every((check) => check.ok) ? 'ready' : 'not_ready',
        checks,
      };
    },
  };
}

export type HealthService = ReturnType<typeof createHealthService>;
