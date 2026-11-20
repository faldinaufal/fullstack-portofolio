// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { SupportGrant, SupportGrantList } from '@tempora/contracts';
import { withDbContext, type PrismaClient, type Tx } from '@tempora/db';
import { recordAudit } from '../../lib/audit.js';
import { auditActor } from '../branches/service.js';
import { notFound } from '../console-auth/access.js';
import type { ConsoleActor } from '../console-auth/guard.js';

const HOUR = 60 * 60_000;
const HISTORY = 20;

type GrantRow = Awaited<ReturnType<typeof loadGrants>>[number];

const loadGrants = (tx: Tx, take: number) =>
  tx.supportGrant.findMany({
    orderBy: [{ startsAt: 'desc' }, { id: 'desc' }],
    take,
    include: { grantedBy: { include: { teamAccount: { select: { name: true } } } } },
  });

/** Active until it expires or the owner revokes it (FSD 7.5). */
export function grantStatus(
  grant: { expiresAt: Date; revokedAt: Date | null },
  now: Date,
): SupportGrant['status'] {
  if (grant.revokedAt) return 'revoked';
  return grant.expiresAt > now ? 'active' : 'expired';
}

const toGrant = (row: GrantRow, now: Date): SupportGrant => ({
  id: row.id,
  status: grantStatus(row, now),
  startsAt: row.startsAt.toISOString(),
  expiresAt: row.expiresAt.toISOString(),
  revokedAt: row.revokedAt?.toISOString() ?? null,
  grantedBy: row.grantedBy.teamAccount.name,
});

export interface SupportGrantDeps {
  prisma: PrismaClient;
  now?: () => Date;
}

/**
 * The owner's side of support access (FSD 1.4, 3.10, 5.4 `/support-grants`): grant for 1, 24
 * or 72 hours, revoke at any time, see the history. Routes allow the owner only.
 */
export function createSupportGrantService({ prisma, now = () => new Date() }: SupportGrantDeps) {
  const inTenant = <T>(actor: ConsoleActor, work: (tx: Tx) => Promise<T>) =>
    withDbContext(prisma, { tenantId: actor.tenantId, teamAccountId: actor.teamAccountId }, work);

  async function list(tx: Tx): Promise<SupportGrantList> {
    const at = now();
    const items = (await loadGrants(tx, HISTORY)).map((row) => toGrant(row, at));
    return { active: items.find((g) => g.status === 'active') ?? null, items };
  }

  return {
    list: (actor: ConsoleActor) => inTenant(actor, list),

    /**
     * A new grant starts now. Granting while one is active replaces it (the old one ends
     * now), so "extend" is the same action. Two grants at once for one business wait for
     * each other (advisory lock); the exclusion constraint is the last line of defence.
     */
    grant: (actor: ConsoleActor, durationHours: 1 | 24 | 72) =>
      inTenant(actor, async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`support:${actor.tenantId}`}, 0))`;
        const at = now();
        const current = await tx.supportGrant.findFirst({
          where: { revokedAt: null, expiresAt: { gt: at } },
        });
        if (current) {
          await tx.supportGrant.update({ where: { id: current.id }, data: { revokedAt: at } });
        }
        const grant = await tx.supportGrant.create({
          data: {
            tenantId: actor.tenantId,
            grantedByMembershipId: actor.membershipId,
            startsAt: at,
            expiresAt: new Date(at.getTime() + durationHours * HOUR),
          },
        });
        await recordAudit(tx, auditActor(actor), {
          tenantId: actor.tenantId,
          action: 'support.granted',
          entityType: 'support_grant',
          entityId: grant.id,
          after: {
            durationHours,
            expiresAt: grant.expiresAt,
            ...(current && { replaces: current.id }),
          },
        });
        return list(tx);
      }),

    /** Ends the grant now; support pages stop working at once (FSD 3.10 step 3). */
    revoke: (actor: ConsoleActor, id: string) =>
      inTenant(actor, async (tx) => {
        const grant = await tx.supportGrant.findUnique({ where: { id } });
        if (!grant) throw notFound('Support grant');
        const at = now();
        // Already expired or revoked: nothing to end, nothing to log.
        if (grantStatus(grant, at) === 'active') {
          await tx.supportGrant.update({ where: { id }, data: { revokedAt: at } });
          await recordAudit(tx, auditActor(actor), {
            tenantId: actor.tenantId,
            action: 'support.revoked',
            entityType: 'support_grant',
            entityId: id,
            before: { expiresAt: grant.expiresAt },
          });
        }
        return list(tx);
      }),
  };
}

export type SupportGrantService = ReturnType<typeof createSupportGrantService>;
