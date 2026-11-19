// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { Prisma, PrismaClient } from './generated/prisma/client.js';

/** A Prisma client bound to one open transaction. */
export type Tx = Prisma.TransactionClient;

/**
 * Who the current queries run for. Row-level security policies (FSD 4.4) read these values;
 * anything left out stays unset, and a policy that depends on it matches no rows.
 */
export interface DbContext {
  /** Tenant of the Console session (tenant policy). */
  tenantId?: string;
  /** Signed-in team account (read its own memberships across tenants). */
  teamAccountId?: string;
  /** HMAC of an invitation link token: reveals that one invitation, before any login. */
  invitationTokenHash?: string;
  /** Logged-in Portal customer: reads their own bookings at every business (customer policy). */
  customerAccountId?: string;
  /** HMAC of a booking access token (guest link): reveals that one token row. */
  bookingTokenHash?: string;
  /** Signed-in platform admin: platform-level audit entries (no tenant). */
  platformAdminId?: string;
}

export interface TransactionOptions {
  /** Upper bound for the whole transaction; long transactions hold row locks. */
  timeoutMs?: number;
}

/**
 * Runs `work` in one transaction whose first statement sets the RLS context.
 *
 * `set_config(..., true)` makes each value local to this transaction, so a pooled
 * connection never carries one request's tenant into the next request. This is the only
 * way the API talks to tenant-owned tables.
 */
export async function withDbContext<T>(
  prisma: PrismaClient,
  context: DbContext,
  work: (tx: Tx) => Promise<T>,
  { timeoutMs = 10_000 }: TransactionOptions = {},
): Promise<T> {
  return prisma.$transaction(
    async (tx) => {
      await setDbContext(tx, context);
      return work(tx);
    },
    { timeout: timeoutMs },
  );
}

/**
 * Replaces the RLS context inside an open transaction. Needed when the tenant only exists
 * part-way through it (business sign-up creates the tenant, then its owner membership).
 */
export async function setDbContext(tx: Tx, context: DbContext): Promise<void> {
  await tx.$queryRaw`
    SELECT
      set_config('app.tenant_id', ${context.tenantId ?? ''}, true),
      set_config('app.team_account_id', ${context.teamAccountId ?? ''}, true),
      set_config('app.invitation_token_hash', ${context.invitationTokenHash ?? ''}, true),
      set_config('app.customer_account_id', ${context.customerAccountId ?? ''}, true),
      set_config('app.booking_token_hash', ${context.bookingTokenHash ?? ''}, true),
      set_config('app.platform_admin_id', ${context.platformAdminId ?? ''}, true)
  `;
}
