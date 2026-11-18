// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { Prisma, Tx } from '@tempora/db';

/** Who performed an action, captured at the time it happened. */
export interface AuditActor {
  type: 'team_member' | 'platform_admin' | 'customer' | 'system';
  /** Membership ID for team members, account ID for others; null for the system. */
  id: string | null;
  /** Name shown in the log, kept even if the person is renamed or removed later. */
  label: string;
  requestId?: string | undefined;
  ip?: string | undefined;
}

export interface AuditEntry {
  /** Null only for platform-level events. */
  tenantId: string | null;
  /** Set for branch-scoped events, so a manager's log shows their branch only. */
  branchId?: string | null;
  /** `<entity>.<verb>`, e.g. `branch.archived`. */
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  reason?: string | null;
}

/** Dates become ISO strings and undefined fields disappear, as they would in the API. */
function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  return value === undefined
    ? undefined
    : (JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue);
}

/**
 * Appends an audit entry in the caller's transaction (FSD 9.2): the entry exists if and
 * only if the change it describes was committed. The table is append-only for the API role.
 */
export async function recordAudit(tx: Tx, actor: AuditActor, entry: AuditEntry): Promise<void> {
  const before = toJson(entry.before);
  const after = toJson(entry.after);
  await tx.auditLog.createMany({
    data: [
      {
        tenantId: entry.tenantId,
        branchId: entry.branchId ?? null,
        actorType: actor.type,
        actorId: actor.id,
        actorLabel: actor.label.slice(0, 150),
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        ...(before !== undefined && { before }),
        ...(after !== undefined && { after }),
        reason: entry.reason ?? null,
        requestId: actor.requestId ?? null,
        ip: actor.ip ?? null,
      },
    ],
  });
}
