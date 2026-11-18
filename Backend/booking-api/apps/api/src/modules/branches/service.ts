// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type {
  BranchDetail,
  BranchSummary,
  Closure,
  CreateBranchRequest,
  CreateClosureRequest,
  OpeningHours,
  UpdateBranchRequest,
} from '@tempora/contracts';
import { withDbContext, type PrismaClient, type Tx } from '@tempora/db';
import { AppError } from '../../lib/app-error.js';
import { recordAudit, type AuditActor } from '../../lib/audit.js';
import { canEditBranch, canSeeBranch, forbidden, notFound } from '../console-auth/access.js';
import type { ConsoleActor } from '../console-auth/guard.js';
import { branchRepository as repo } from './repository.js';

// PostgreSQL `time` and `date` columns arrive as Dates on 1970-01-01 / at UTC midnight.
export const toWallTime = (value: Date) => value.toISOString().slice(11, 16);
export const fromWallTime = (value: string) => new Date(`1970-01-01T${value}:00.000Z`);
export const toDateOnly = (value: Date) => value.toISOString().slice(0, 10);
export const fromDateOnly = (value: string) => new Date(`${value}T00:00:00.000Z`);

type BranchRow = NonNullable<Awaited<ReturnType<typeof repo.find>>>;

function toSummary(branch: BranchRow): BranchSummary {
  return {
    id: branch.id,
    name: branch.name,
    address: branch.address,
    phone: branch.phone,
    archived: branch.archivedAt !== null,
    version: branch.version,
    activeMembers: branch._count.memberships,
  };
}

const toHours = (rows: { weekday: number; opensAt: Date; closesAt: Date }[]): OpeningHours[] =>
  rows.map((row) => ({
    weekday: row.weekday,
    opensAt: toWallTime(row.opensAt),
    closesAt: toWallTime(row.closesAt),
  }));

const toClosure = (row: { id: string; startsOn: Date; endsOn: Date; reason: string }): Closure => ({
  id: row.id,
  startsOn: toDateOnly(row.startsOn),
  endsOn: toDateOnly(row.endsOn),
  reason: row.reason,
});

export function auditActor(actor: ConsoleActor): AuditActor {
  return {
    type: 'team_member',
    id: actor.membershipId,
    label: actor.accountName,
    requestId: actor.requestId,
    ip: actor.ip,
  };
}

export interface BranchServiceDeps {
  prisma: PrismaClient;
  now?: () => Date;
}

/** Branches, opening hours and closures (FSD 2.2 Branches, 5.4, 6.8). */
export function createBranchService({ prisma, now = () => new Date() }: BranchServiceDeps) {
  const inTenant = <T>(actor: ConsoleActor, work: (tx: Tx) => Promise<T>) =>
    withDbContext(prisma, { tenantId: actor.tenantId, teamAccountId: actor.teamAccountId }, work);

  /** Loads a branch the actor may see, or answers 404. */
  async function visibleBranch(tx: Tx, actor: ConsoleActor, id: string) {
    const branch = await repo.find(tx, actor.tenantId, id);
    if (!branch || !canSeeBranch(actor, branch.id)) throw notFound('Branch');
    return branch;
  }

  async function editableBranch(tx: Tx, actor: ConsoleActor, id: string) {
    const branch = await visibleBranch(tx, actor, id);
    if (!canEditBranch(actor, branch.id))
      throw forbidden('Only the owner or this branch’s manager can change it.');
    if (branch.archivedAt) {
      throw new AppError({
        status: 409,
        code: 'VALIDATION_FAILED',
        title: 'Branch archived',
        detail: 'An archived branch cannot be changed.',
      });
    }
    return branch;
  }

  async function detail(tx: Tx, branch: BranchRow): Promise<BranchDetail> {
    const today = new Date(`${now().toISOString().slice(0, 10)}T00:00:00.000Z`);
    const [hours, closures] = await Promise.all([
      repo.openingHours(tx, branch.id),
      repo.upcomingClosures(tx, branch.id, today),
    ]);
    return {
      ...toSummary(branch),
      openingHours: toHours(hours),
      closures: closures.map(toClosure),
    };
  }

  return {
    /** Owner: every branch (archived last). Manager and staff: their own branch. */
    list: (actor: ConsoleActor) =>
      inTenant(actor, async (tx) => {
        const branches = await repo.list(
          tx,
          actor.tenantId,
          actor.role === 'owner' ? undefined : (actor.branchId ?? undefined),
        );
        return { items: branches.map(toSummary) };
      }),

    get: (actor: ConsoleActor, id: string) =>
      inTenant(actor, async (tx) => detail(tx, await visibleBranch(tx, actor, id))),

    create: (actor: ConsoleActor, input: CreateBranchRequest) =>
      inTenant(actor, async (tx) => {
        const branch = await repo.create(tx, {
          tenantId: actor.tenantId,
          name: input.name,
          address: input.address ?? null,
          phone: input.phone ?? null,
        });
        const result = await detail(tx, branch);
        await recordAudit(tx, auditActor(actor), {
          tenantId: actor.tenantId,
          branchId: branch.id,
          action: 'branch.created',
          entityType: 'branch',
          entityId: branch.id,
          after: toSummary(branch),
        });
        return result;
      }),

    /**
     * Optimistic locking (FSD 4.1): the caller sends the version it loaded; if someone else
     * saved in between, the update is rejected instead of silently overwriting their change.
     */
    update: (actor: ConsoleActor, id: string, version: number, input: UpdateBranchRequest) =>
      inTenant(actor, async (tx) => {
        const before = await editableBranch(tx, actor, id);
        const changed = await repo.updateIfVersion(tx, id, version, input);
        if (changed === 0) {
          throw new AppError({
            status: 409,
            code: 'VERSION_CONFLICT',
            title: 'Changed by someone else',
            detail: 'This branch was changed since you opened it. Reload and try again.',
          });
        }
        const after = await visibleBranch(tx, actor, id);
        await recordAudit(tx, auditActor(actor), {
          tenantId: actor.tenantId,
          branchId: id,
          action: 'branch.updated',
          entityType: 'branch',
          entityId: id,
          before: toSummary(before),
          after: toSummary(after),
        });
        return detail(tx, after);
      }),

    /**
     * Archive (owner). Rejected while members still work there: move or deactivate them
     * first. Open invitations to the branch are revoked. Future bookings will block it too
     * once bookings exist (FSD 6.8).
     */
    archive: (actor: ConsoleActor, id: string) =>
      inTenant(actor, async (tx) => {
        const branch = await editableBranch(tx, actor, id);
        if (branch._count.memberships > 0) {
          throw new AppError({
            status: 409,
            code: 'HAS_ACTIVE_MEMBERS',
            title: 'Branch still has members',
            detail: `${branch._count.memberships} active member(s) work at this branch. Move or deactivate them first.`,
          });
        }
        const archived = await repo.archive(tx, id, now());
        await repo.revokeOpenInvitations(tx, id, now());
        await recordAudit(tx, auditActor(actor), {
          tenantId: actor.tenantId,
          branchId: id,
          action: 'branch.archived',
          entityType: 'branch',
          entityId: id,
          before: toSummary(branch),
          after: { ...toSummary(branch), archived: true, version: archived.version },
        });
        return detail(tx, { ...branch, ...archived });
      }),

    /** Replaces the whole week; a weekday left out is closed. */
    replaceOpeningHours: (actor: ConsoleActor, id: string, hours: OpeningHours[]) =>
      inTenant(actor, async (tx) => {
        const branch = await editableBranch(tx, actor, id);
        const before = toHours(await repo.openingHours(tx, id));
        await repo.replaceOpeningHours(
          tx,
          actor.tenantId,
          id,
          hours.map((h) => ({
            weekday: h.weekday,
            opensAt: fromWallTime(h.opensAt),
            closesAt: fromWallTime(h.closesAt),
          })),
        );
        const result = await detail(tx, branch);
        await recordAudit(tx, auditActor(actor), {
          tenantId: actor.tenantId,
          branchId: id,
          action: 'branch.opening_hours_replaced',
          entityType: 'branch',
          entityId: id,
          before,
          after: result.openingHours,
        });
        return result;
      }),

    addClosure: (actor: ConsoleActor, id: string, input: CreateClosureRequest) =>
      inTenant(actor, async (tx) => {
        await editableBranch(tx, actor, id);
        const closure = await repo.createClosure(tx, {
          tenantId: actor.tenantId,
          branchId: id,
          startsOn: fromDateOnly(input.startsOn),
          endsOn: fromDateOnly(input.endsOn),
          reason: input.reason,
        });
        await recordAudit(tx, auditActor(actor), {
          tenantId: actor.tenantId,
          branchId: id,
          action: 'branch.closure_added',
          entityType: 'branch_closure',
          entityId: closure.id,
          after: toClosure(closure),
        });
        return toClosure(closure);
      }),

    removeClosure: (actor: ConsoleActor, id: string, closureId: string) =>
      inTenant(actor, async (tx) => {
        await editableBranch(tx, actor, id);
        const closure = await repo.findClosure(tx, id, closureId);
        if (!closure) throw notFound('Closure');
        await repo.deleteClosure(tx, closureId);
        await recordAudit(tx, auditActor(actor), {
          tenantId: actor.tenantId,
          branchId: id,
          action: 'branch.closure_removed',
          entityType: 'branch_closure',
          entityId: closureId,
          before: toClosure(closure),
        });
      }),
  };
}

export type BranchService = ReturnType<typeof createBranchService>;
