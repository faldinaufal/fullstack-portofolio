// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { PrismaClient } from '@tempora/db';

export interface StoredDemoEmail {
  id: string;
  toEmail: string;
  subject: string;
  textBody: string;
  createdAt: Date;
}

/** Reads the demo inbox (FSD 4.3). An interface, so the service tests can pass a fake. */
export interface DemoInboxRepository {
  latest(query: { to: string | undefined; since: Date; limit: number }): Promise<StoredDemoEmail[]>;
}

/**
 * `demo_emails` has no RLS (public by design), so no tenant context is set: the API role may
 * only read it, the worker writes it.
 */
export function createPrismaDemoInboxRepository(prisma: PrismaClient): DemoInboxRepository {
  return {
    latest: ({ to, since, limit }) =>
      prisma.demoEmail.findMany({
        where: { createdAt: { gte: since }, ...(to !== undefined && { toEmail: to }) },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit,
        select: { id: true, toEmail: true, subject: true, textBody: true, createdAt: true },
      }),
  };
}
