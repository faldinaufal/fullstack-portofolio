// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';

export interface CreatePrismaClientOptions {
  /** Connection string of the application role (RLS enforced). */
  connectionString: string;
  /** Maximum connections in this process's pool. */
  maxConnections?: number;
}

/**
 * Creates a Prisma client that talks to PostgreSQL through the `pg` driver adapter.
 * One client per process; it owns a connection pool, so never create one per request.
 */
export function createPrismaClient({
  connectionString,
  maxConnections = 10,
}: CreatePrismaClientOptions): PrismaClient {
  // Sessions run in UTC. The adapter sends timestamps without an offset, and PostgreSQL reads
  // those in the session time zone: on a server set to another zone, every stored instant
  // would shift, and comparisons with the database clock (`now()` in RLS policies and worker
  // jobs) would be off by that many hours.
  const adapter = new PrismaPg({
    connectionString,
    max: maxConnections,
    options: '-c TimeZone=UTC',
  });
  return new PrismaClient({ adapter });
}

export type { PrismaClient };
