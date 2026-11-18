// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { PrismaClient } from '@tempora/db';

/** Data access needed by the health checks. An interface, so tests can swap in a fake. */
export interface HealthRepository {
  /** Resolves when the database answers a trivial query. */
  pingDatabase(): Promise<void>;
  /** Number of migrations that were started but never finished (should be 0). */
  countUnfinishedMigrations(): Promise<number>;
}

export function createPrismaHealthRepository(prisma: PrismaClient): HealthRepository {
  return {
    async pingDatabase() {
      await prisma.$queryRaw`SELECT 1`;
    },
    async countUnfinishedMigrations() {
      const rows = await prisma.$queryRaw<{ count: bigint }[]>`
        SELECT count(*) AS count
        FROM _prisma_migrations
        WHERE finished_at IS NULL AND rolled_back_at IS NULL
      `;
      return Number(rows[0]?.count ?? 0);
    },
  };
}
