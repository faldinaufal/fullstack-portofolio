// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type {
  AdminOverview,
  AdminTenant,
  AdminTenantDetail,
  AdminTenantList,
  AdminTenantListQuery,
  CreateTenantRequest,
  PlatformAuditList,
  PlatformAuditQuery,
} from '@tempora/contracts';
import { Prisma, setDbContext, withDbContext, type PrismaClient, type Tx } from '@tempora/db';
import { AppError } from '../../lib/app-error.js';
import { recordAudit, type AuditActor } from '../../lib/audit.js';
import { generateToken, type TokenHasher } from '../../lib/tokens.js';
import type { AdminActor } from '../admin-auth/guard.js';
import { addDays } from '../reports/calc.js';
import { todayIn } from '../availability/engine.js';
import { notFound } from '../console-auth/access.js';
import { consoleAuthRepository } from '../console-auth/repository.js';

const DAY = 24 * 60 * 60_000;
/** FSD 3.5 / 6.8: the owner invitation is valid for 7 days, like every invitation. */
const INVITATION_TTL_MS = 7 * DAY;
const OVERVIEW_DAYS = 14;

interface Usage {
  tenant_id: string;
  members: number;
  recent_bookings: number;
  setup_complete: boolean;
}

export interface AdminServiceDeps {
  prisma: PrismaClient;
  hashToken: TokenHasher;
  consoleUrl: string;
  timeZone: string;
  now?: () => Date;
}

/** "Active" means taking bookings; "onboarding" is active but not set up yet. */
function matchesStatus(tenant: AdminTenant, status: AdminTenantListQuery['status']): boolean {
  if (status === 'onboarding') return tenant.onboarding;
  if (status === 'active') return tenant.status === 'active' && !tenant.onboarding;
  return true;
}

const slugTaken = () =>
  new AppError({
    status: 409,
    code: 'SLUG_TAKEN',
    title: 'Address taken',
    detail: 'Another business already uses this address.',
    errors: [{ path: 'slug', message: 'Already in use.' }],
  });

/**
 * Platform Admin (FSD 2.3, 3.5, 3.11, 5.5): tenants, assisted onboarding, suspension,
 * platform metrics and the platform log. Tenant business data is out of reach here (support
 * access is a separate, owner-granted path); only metadata and counts are read.
 */
export function createAdminService({
  prisma,
  hashToken,
  consoleUrl,
  timeZone,
  now = () => new Date(),
}: AdminServiceDeps) {
  /** Platform context: the platform log and the tables that are not tenant-owned. */
  const asAdmin = <T>(actor: AdminActor, work: (tx: Tx) => Promise<T>) =>
    withDbContext(prisma, { platformAdminId: actor.adminId }, work);

  const auditActorOf = (actor: AdminActor): AuditActor => ({
    type: 'platform_admin',
    id: actor.adminId,
    label: `${actor.name} (Tempora)`,
    requestId: actor.requestId,
    ip: actor.ip,
  });

  /** One change, written to the tenant's log (the owner sees it) and to the platform log. */
  async function auditBoth(
    tx: Tx,
    actor: AdminActor,
    tenantId: string,
    entry: { action: string; before?: object; after?: object; reason?: string },
  ) {
    await setDbContext(tx, { tenantId, platformAdminId: actor.adminId });
    const base = { entityType: 'tenant', entityId: tenantId, ...entry };
    await recordAudit(tx, auditActorOf(actor), { ...base, tenantId });
    await recordAudit(tx, auditActorOf(actor), { ...base, tenantId: null });
  }

  async function usageMap(tx: Tx) {
    const since = new Date(now().getTime() - 30 * DAY);
    const rows = await tx.$queryRaw<Usage[]>`SELECT * FROM platform_tenant_usage(${since})`;
    return new Map(rows.map((r) => [r.tenant_id, r]));
  }

  const toTenant = (
    tenant: {
      id: string;
      name: string;
      slug: string;
      status: 'active' | 'suspended';
      createdAt: Date;
    },
    usage: Usage | undefined,
  ): AdminTenant => ({
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    status: tenant.status,
    onboarding: tenant.status === 'active' && !(usage?.setup_complete ?? false),
    createdAt: tenant.createdAt.toISOString(),
    members: usage?.members ?? 0,
    recentBookings: usage?.recent_bookings ?? 0,
  });

  async function detail(tx: Tx, id: string): Promise<AdminTenantDetail> {
    const tenant = await tx.tenant.findFirst({ where: { id, archivedAt: null } });
    if (!tenant) throw notFound('Tenant');
    const usage = (await usageMap(tx)).get(id);
    // Who to contact: the owner, or the pending owner invitation (metadata, not business data).
    await setDbContext(tx, { tenantId: id });
    const owner = await tx.membership.findFirst({
      where: { role: 'owner', status: 'active' },
      include: { teamAccount: { select: { name: true, email: true } } },
    });
    const invitation = owner
      ? null
      : await tx.invitation.findFirst({
          where: { role: 'owner', acceptedAt: null, revokedAt: null },
          orderBy: { createdAt: 'desc' },
        });
    return {
      ...toTenant(tenant, usage),
      invoicePrefix: tenant.invoicePrefix,
      suspendedAt: tenant.suspendedAt?.toISOString() ?? null,
      suspensionReason: tenant.suspensionReason,
      owner: owner ? { name: owner.teamAccount.name, email: owner.teamAccount.email } : null,
      ownerInvitation: invitation
        ? {
            email: invitation.email,
            status: invitation.expiresAt > now() ? 'pending' : 'expired',
            expiresAt: invitation.expiresAt.toISOString(),
          }
        : null,
    };
  }

  /** The owner's address for suspension emails (null while nobody accepted the invitation). */
  async function ownerOf(tx: Tx, tenantId: string) {
    await setDbContext(tx, { tenantId });
    return tx.membership.findFirst({
      where: { role: 'owner', status: 'active' },
      include: { teamAccount: { select: { name: true, email: true } } },
    });
  }

  return {
    overview: (actor: AdminActor): Promise<AdminOverview> =>
      asAdmin(actor, async (tx) => {
        const usage = await usageMap(tx);
        const tenants = await tx.tenant.findMany({
          where: { archivedAt: null },
          select: { id: true, status: true },
        });
        const today = todayIn(timeZone, now());
        const first = addDays(today, -(OVERVIEW_DAYS - 1));
        const since = new Date(now().getTime() - (OVERVIEW_DAYS + 1) * DAY);
        const activity = await tx.$queryRaw<
          { day: Date; bookings: number; payments: number; revenue_cents: bigint }[]
        >`SELECT * FROM platform_daily_activity(${since}, ${timeZone})`;
        const byDay = new Map(activity.map((a) => [a.day.toISOString().slice(0, 10), a]));
        const [health] = await tx.$queryRaw<
          { payments_needing_attention: number; emails_queued: number; emails_failed: number }[]
        >`SELECT * FROM platform_health(${new Date(now().getTime() - DAY)})`;

        return {
          timeZone,
          tenants: {
            active: tenants.filter((t) => t.status === 'active' && usage.get(t.id)?.setup_complete)
              .length,
            onboarding: tenants.filter(
              (t) => t.status === 'active' && !usage.get(t.id)?.setup_complete,
            ).length,
            suspended: tenants.filter((t) => t.status === 'suspended').length,
          },
          days: Array.from({ length: OVERVIEW_DAYS }, (_, i) => {
            const date = addDays(first, i);
            const row = byDay.get(date);
            return {
              date,
              bookings: row?.bookings ?? 0,
              payments: row?.payments ?? 0,
              revenueCents: Number(row?.revenue_cents ?? 0),
            };
          }),
          health: {
            paymentsNeedingAttention: health?.payments_needing_attention ?? 0,
            emailsQueued: health?.emails_queued ?? 0,
            emailsFailed: health?.emails_failed ?? 0,
          },
        };
      }),

    /**
     * Search, status and paging. Usage comes from one aggregate call for all tenants; at
     * this product's scale (a few hundred businesses) filtering "onboarding" in memory is fine.
     */
    tenants: (actor: AdminActor, query: AdminTenantListQuery): Promise<AdminTenantList> =>
      asAdmin(actor, async (tx) => {
        const usage = await usageMap(tx);
        const rows = await tx.tenant.findMany({
          where: {
            archivedAt: null,
            ...(query.status === 'suspended' && { status: 'suspended' }),
            ...((query.status === 'active' || query.status === 'onboarding') && {
              status: 'active',
            }),
            ...(query.q && {
              OR: [
                { name: { contains: query.q, mode: 'insensitive' } },
                { slug: { contains: query.q.toLowerCase() } },
              ],
            }),
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        });
        const all = rows
          .map((t) => toTenant(t, usage.get(t.id)))
          .filter((t) => matchesStatus(t, query.status));
        const start = (query.page - 1) * query.pageSize;
        return {
          items: all.slice(start, start + query.pageSize),
          page: query.page,
          pageSize: query.pageSize,
          total: all.length,
        };
      }),

    tenant: (actor: AdminActor, id: string) => asAdmin(actor, (tx) => detail(tx, id)),

    /**
     * FSD 3.5 assisted onboarding: the business (with its invoice prefix) and an owner
     * invitation; accepting it opens the onboarding wizard. Audited in both logs.
     */
    async createTenant(actor: AdminActor, input: CreateTenantRequest): Promise<AdminTenantDetail> {
      const attempt = () =>
        asAdmin(actor, async (tx) => {
          if (await tx.tenant.findUnique({ where: { slug: input.slug } })) throw slugTaken();
          const tenant = await consoleAuthRepository.createTenant(tx, {
            slug: input.slug,
            name: input.businessName,
          });
          await setDbContext(tx, { tenantId: tenant.id, platformAdminId: actor.adminId });
          const token = generateToken();
          const at = now();
          await tx.invitation.create({
            data: {
              tenantId: tenant.id,
              email: input.ownerEmail,
              role: 'owner',
              branchId: null,
              tokenHash: hashToken('invitation', token),
              invitedByMembershipId: null,
              createdAt: at,
              expiresAt: new Date(at.getTime() + INVITATION_TTL_MS),
            },
          });
          await tx.emailMessage.create({
            data: {
              tenantId: tenant.id,
              toEmail: input.ownerEmail,
              template: 'console.invitation',
              payload: {
                businessName: tenant.name,
                inviterName: 'The Tempora team',
                role: 'owner',
                branchName: null,
                acceptUrl: new URL(`/invite/${token}`, consoleUrl).toString(),
                expiresInDays: INVITATION_TTL_MS / DAY,
              },
            },
          });
          await auditBoth(tx, actor, tenant.id, {
            action: 'tenant.created',
            after: { name: tenant.name, slug: tenant.slug, ownerEmail: input.ownerEmail },
          });
          return detail(tx, tenant.id);
        });
      // Two creations at once: the unique slug decides; a clash on the generated invoice
      // prefix only needs another try (same rule as the Console sign-up).
      for (let tries = 1; ; tries += 1) {
        try {
          return await attempt();
        } catch (error) {
          if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
            throw error;
          }
          if (await prisma.tenant.findUnique({ where: { slug: input.slug } })) throw slugTaken();
          if (tries >= 3) throw error;
        }
      }
    },

    /** FSD 3.11 / 6.9: suspended with a reason; the owner is emailed; both logs. */
    suspend: (actor: AdminActor, id: string, reason: string) =>
      asAdmin(actor, async (tx) => {
        const tenant = await tx.tenant.findFirst({ where: { id, archivedAt: null } });
        if (!tenant) throw notFound('Tenant');
        if (tenant.status === 'suspended') return detail(tx, id);
        await tx.tenant.update({
          where: { id },
          data: {
            status: 'suspended',
            suspendedAt: now(),
            suspensionReason: reason,
            version: { increment: 1 },
          },
        });
        await auditBoth(tx, actor, id, {
          action: 'tenant.suspended',
          before: { status: 'active' },
          after: { status: 'suspended' },
          reason,
        });
        const owner = await ownerOf(tx, id);
        if (owner) {
          await tx.emailMessage.create({
            data: {
              tenantId: id,
              toEmail: owner.teamAccount.email,
              template: 'console.tenant_suspended',
              payload: { name: owner.teamAccount.name, businessName: tenant.name, reason },
            },
          });
        }
        await setDbContext(tx, { platformAdminId: actor.adminId });
        return detail(tx, id);
      }),

    reactivate: (actor: AdminActor, id: string) =>
      asAdmin(actor, async (tx) => {
        const tenant = await tx.tenant.findFirst({ where: { id, archivedAt: null } });
        if (!tenant) throw notFound('Tenant');
        if (tenant.status === 'active') return detail(tx, id);
        await tx.tenant.update({
          where: { id },
          data: {
            status: 'active',
            suspendedAt: null,
            suspensionReason: null,
            version: { increment: 1 },
          },
        });
        await auditBoth(tx, actor, id, {
          action: 'tenant.reactivated',
          before: { status: 'suspended', reason: tenant.suspensionReason },
          after: { status: 'active' },
        });
        const owner = await ownerOf(tx, id);
        if (owner) {
          await tx.emailMessage.create({
            data: {
              tenantId: id,
              toEmail: owner.teamAccount.email,
              template: 'console.tenant_reactivated',
              payload: { name: owner.teamAccount.name, businessName: tenant.name, consoleUrl },
            },
          });
        }
        await setDbContext(tx, { platformAdminId: actor.adminId });
        return detail(tx, id);
      }),

    /** Platform-level events only (`tenant_id` null), through the platform policy. */
    audit: (actor: AdminActor, query: PlatformAuditQuery): Promise<PlatformAuditList> =>
      asAdmin(actor, async (tx) => {
        const where = { tenantId: null };
        const rows = await tx.auditLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        });
        return {
          items: rows.map((r) => ({
            id: r.id,
            at: r.createdAt.toISOString(),
            actor: r.actorLabel,
            action: r.action,
            entityType: r.entityType,
            entityId: r.entityId,
            reason: r.reason,
            after: r.after,
          })),
          page: query.page,
          pageSize: query.pageSize,
          total: await tx.auditLog.count({ where }),
        };
      }),
  };
}

export type AdminService = ReturnType<typeof createAdminService>;
