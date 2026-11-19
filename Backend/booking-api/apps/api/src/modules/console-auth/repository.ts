// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { Tx } from '@tempora/db';
import type { OutboxEmail } from '@tempora/db/emails';
import { invoicePrefixBase, nextInvoicePrefix } from '../bookings/invoice-number.js';

/**
 * Prisma queries for Console authentication. Every function receives the transaction it runs
 * in, so the service decides what belongs together atomically and under which RLS context.
 * Identity tables (accounts, sessions, codes, devices, tokens) are not tenant-owned and have
 * no RLS; memberships are read through the account's own-memberships policy.
 */
export const consoleAuthRepository = {
  // --- accounts -----------------------------------------------------------
  findAccountByEmail: (tx: Tx, email: string) => tx.teamAccount.findUnique({ where: { email } }),

  findAccountById: (tx: Tx, id: string) => tx.teamAccount.findUnique({ where: { id } }),

  createAccount: (tx: Tx, data: { email: string; name: string; passwordHash: string }) =>
    tx.teamAccount.create({ data }),

  markEmailVerified: (tx: Tx, accountId: string, now: Date) =>
    tx.teamAccount.updateMany({
      where: { id: accountId, emailVerifiedAt: null },
      data: { emailVerifiedAt: now },
    }),

  updatePassword: (tx: Tx, accountId: string, passwordHash: string, now: Date) =>
    tx.teamAccount.update({
      where: { id: accountId },
      data: { passwordHash, passwordChangedAt: now },
    }),

  // --- tenants and memberships ----------------------------------------------
  slugExists: async (tx: Tx, slug: string) => (await tx.tenant.count({ where: { slug } })) > 0,

  /**
   * Creates the tenant with the first free invoice prefix derived from its slug (FSD 6.10).
   * A concurrent sign-up taking the same prefix fails on the unique index and is retried
   * by the caller.
   */
  createTenant: async (tx: Tx, data: { slug: string; name: string }) => {
    const base = invoicePrefixBase(data.slug);
    const taken = await tx.tenant.findMany({
      where: { invoicePrefix: { startsWith: base } },
      select: { invoicePrefix: true },
    });
    const invoicePrefix = nextInvoicePrefix(
      base,
      taken.map((t) => t.invoicePrefix),
    );
    return tx.tenant.create({ data: { ...data, invoicePrefix } });
  },

  /** Requires the RLS context of the new tenant (tenant policy WITH CHECK). */
  createOwnerMembership: (tx: Tx, data: { tenantId: string; teamAccountId: string }) =>
    tx.membership.create({ data: { ...data, role: 'owner', branchId: null } }),

  /** Active memberships in non-archived tenants. Requires the account's RLS context. */
  listActiveMemberships: (tx: Tx, teamAccountId: string) =>
    tx.membership.findMany({
      where: { teamAccountId, status: 'active', tenant: { archivedAt: null } },
      include: {
        tenant: {
          select: {
            id: true,
            slug: true,
            name: true,
            status: true,
            suspendedAt: true,
            suspensionReason: true,
          },
        },
        teamAccount: { select: { name: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),

  lastUsedMembershipId: async (tx: Tx, teamAccountId: string) => {
    const session = await tx.session.findFirst({
      where: { teamAccountId, app: 'console' },
      orderBy: { createdAt: 'desc' },
      select: { membershipId: true },
    });
    return session?.membershipId ?? null;
  },

  // --- email codes ----------------------------------------------------------
  createLoginChallenge: (
    tx: Tx,
    data: {
      id: string;
      teamAccountId: string;
      codeHash: string;
      expiresAt: Date;
      now: Date;
      ip: string;
    },
  ) =>
    tx.otpChallenge.create({
      data: {
        id: data.id,
        purpose: 'login',
        teamAccountId: data.teamAccountId,
        codeHash: data.codeHash,
        createdAt: data.now,
        lastSentAt: data.now,
        expiresAt: data.expiresAt,
        ip: data.ip,
      },
    }),

  findLoginChallenge: (tx: Tx, id: string) =>
    tx.otpChallenge.findFirst({ where: { id, purpose: 'login' } }),

  /**
   * Counts a wrong code atomically. Returns the new attempt count, or null when the
   * challenge was already used up by a concurrent request.
   */
  recordWrongCode: async (tx: Tx, id: string, maxAttempts: number) => {
    const rows = await tx.$queryRaw<{ attempts: number }[]>`
      UPDATE otp_challenges SET attempts = attempts + 1
      WHERE id = ${id}::uuid AND consumed_at IS NULL AND attempts < ${maxAttempts}
      RETURNING attempts
    `;
    return rows[0]?.attempts ?? null;
  },

  /** Marks the code as used. False when another request used it first (no double login). */
  consumeChallenge: async (tx: Tx, id: string, now: Date) => {
    const { count } = await tx.otpChallenge.updateMany({
      where: { id, consumedAt: null },
      data: { consumedAt: now },
    });
    return count === 1;
  },

  replaceChallengeCode: (
    tx: Tx,
    id: string,
    data: { codeHash: string; now: Date; expiresAt: Date },
  ) =>
    tx.otpChallenge.update({
      where: { id },
      data: { codeHash: data.codeHash, lastSentAt: data.now, expiresAt: data.expiresAt },
    }),

  // --- sessions -------------------------------------------------------------
  createConsoleSession: (
    tx: Tx,
    data: {
      tokenHash: string;
      teamAccountId: string;
      membershipId: string;
      now: Date;
      expiresAt: Date;
      ip: string;
      userAgent: string | null;
    },
  ) =>
    tx.session.create({
      data: {
        tokenHash: data.tokenHash,
        app: 'console',
        teamAccountId: data.teamAccountId,
        membershipId: data.membershipId,
        createdAt: data.now,
        lastSeenAt: data.now,
        expiresAt: data.expiresAt,
        ip: data.ip,
        userAgent: data.userAgent,
      },
    }),

  findConsoleSession: (tx: Tx, tokenHash: string) =>
    tx.session.findFirst({ where: { tokenHash, app: 'console' } }),

  touchSession: (tx: Tx, id: string, now: Date) =>
    tx.session.update({ where: { id }, data: { lastSeenAt: now } }),

  revokeSession: (tx: Tx, id: string, now: Date) =>
    tx.session.updateMany({ where: { id, revokedAt: null }, data: { revokedAt: now } }),

  /** Ends every session bound to one membership (deactivated, demoted or moved, FSD 6.8). */
  revokeMembershipSessions: (tx: Tx, membershipId: string, now: Date) =>
    tx.session.updateMany({ where: { membershipId, revokedAt: null }, data: { revokedAt: now } }),

  revokeAllSessions: (tx: Tx, teamAccountId: string, now: Date) =>
    tx.session.updateMany({ where: { teamAccountId, revokedAt: null }, data: { revokedAt: now } }),

  // --- trusted devices ------------------------------------------------------
  createTrustedDevice: (
    tx: Tx,
    data: { teamAccountId: string; tokenHash: string; label: string; now: Date; expiresAt: Date },
  ) =>
    tx.trustedDevice.create({
      data: {
        teamAccountId: data.teamAccountId,
        tokenHash: data.tokenHash,
        label: data.label,
        createdAt: data.now,
        lastUsedAt: data.now,
        expiresAt: data.expiresAt,
      },
    }),

  findTrustedDevice: (tx: Tx, teamAccountId: string, tokenHash: string) =>
    tx.trustedDevice.findFirst({ where: { teamAccountId, tokenHash } }),

  touchTrustedDevice: (tx: Tx, id: string, now: Date) =>
    tx.trustedDevice.update({ where: { id }, data: { lastUsedAt: now } }),

  revokeAllTrustedDevices: (tx: Tx, teamAccountId: string, now: Date) =>
    tx.trustedDevice.updateMany({
      where: { teamAccountId, revokedAt: null },
      data: { revokedAt: now },
    }),

  // --- password reset -------------------------------------------------------
  createPasswordResetToken: (
    tx: Tx,
    data: { teamAccountId: string; tokenHash: string; now: Date; expiresAt: Date },
  ) =>
    tx.authToken.create({
      data: {
        purpose: 'password_reset',
        teamAccountId: data.teamAccountId,
        tokenHash: data.tokenHash,
        createdAt: data.now,
        expiresAt: data.expiresAt,
      },
    }),

  findPasswordResetToken: (tx: Tx, tokenHash: string) =>
    tx.authToken.findFirst({ where: { tokenHash, purpose: 'password_reset' } }),

  /** Single use: false when the token was already used (or used concurrently). */
  useToken: async (tx: Tx, id: string, now: Date) => {
    const { count } = await tx.authToken.updateMany({
      where: { id, usedAt: null },
      data: { usedAt: now },
    });
    return count === 1;
  },

  // --- outbox ---------------------------------------------------------------
  /**
   * Queues an email in the same transaction as the change that caused it.
   * `createMany` is used because it does not read the row back: account emails have no
   * tenant, and RLS lets the API insert them but not select them.
   */
  enqueueEmail: (tx: Tx, email: OutboxEmail) =>
    tx.emailMessage.createMany({
      data: [
        {
          tenantId: email.tenantId,
          toEmail: email.to,
          template: email.template,
          payload: email.payload,
        },
      ],
    }),
};

export type ConsoleAuthRepository = typeof consoleAuthRepository;
