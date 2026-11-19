// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { SetupStatus, TenantSettings, UpdateTenantRequest } from '@tempora/contracts';
import { withDbContext, type PrismaClient, type Tx } from '@tempora/db';
import { recordAudit } from '../../lib/audit.js';
import { versionConflict } from '../../lib/route-schemas.js';
import { auditActor } from '../branches/service.js';
import type { ConsoleActor } from '../console-auth/guard.js';

/**
 * Setup is complete when customers could book something (FSD 3.4 step 3): an active branch,
 * an active service, and an active therapist at an active branch with working hours who
 * performs an active service. Derived on every read, never stored (FSD 7.5).
 */
export async function setupStatus(tx: Tx, tenantId: string): Promise<SetupStatus> {
  const [branches, services, therapists] = await Promise.all([
    tx.branch.count({ where: { tenantId, archivedAt: null } }),
    tx.service.count({ where: { tenantId, archivedAt: null } }),
    tx.membership.count({
      where: {
        tenantId,
        status: 'active',
        branch: { archivedAt: null },
        workingHours: { some: {} },
        services: { some: { service: { archivedAt: null } } },
      },
    }),
  ]);
  const status = {
    hasBranch: branches > 0,
    hasService: services > 0,
    hasBookableTherapist: therapists > 0,
  };
  return {
    ...status,
    complete: status.hasBranch && status.hasService && status.hasBookableTherapist,
  };
}

type TenantRow = Awaited<ReturnType<Tx['tenant']['findUniqueOrThrow']>>;

function toSettings(tenant: TenantRow, setup: SetupStatus): TenantSettings {
  return {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    status: tenant.status,
    version: tenant.version,
    bookingSettings: {
      minLeadHours: tenant.minLeadHours,
      maxAdvanceDays: tenant.maxAdvanceDays,
      cancellationCutoffHours: tenant.cancellationCutoffHours,
      maxCustomerReschedules: tenant.maxCustomerReschedules,
    },
    setup,
  };
}

/** Business profile and booking settings (FSD 2.2 Settings, 5.4 `/tenant`, 6.1). */
export function createTenantService({ prisma }: { prisma: PrismaClient }) {
  const inTenant = <T>(actor: ConsoleActor, work: (tx: Tx) => Promise<T>) =>
    withDbContext(prisma, { tenantId: actor.tenantId, teamAccountId: actor.teamAccountId }, work);

  return {
    get: (actor: ConsoleActor) =>
      inTenant(actor, async (tx) => {
        const tenant = await tx.tenant.findUniqueOrThrow({ where: { id: actor.tenantId } });
        return toSettings(tenant, await setupStatus(tx, actor.tenantId));
      }),

    /** Owner only; optimistic locking like every versioned record (FSD 4.1). */
    update: (actor: ConsoleActor, version: number, input: UpdateTenantRequest) =>
      inTenant(actor, async (tx) => {
        const before = await tx.tenant.findUniqueOrThrow({ where: { id: actor.tenantId } });
        const settings = input.bookingSettings ?? {};
        const { count } = await tx.tenant.updateMany({
          where: { id: actor.tenantId, version },
          data: {
            ...(input.name !== undefined && { name: input.name }),
            ...(settings.minLeadHours !== undefined && { minLeadHours: settings.minLeadHours }),
            ...(settings.maxAdvanceDays !== undefined && {
              maxAdvanceDays: settings.maxAdvanceDays,
            }),
            ...(settings.cancellationCutoffHours !== undefined && {
              cancellationCutoffHours: settings.cancellationCutoffHours,
            }),
            ...(settings.maxCustomerReschedules !== undefined && {
              maxCustomerReschedules: settings.maxCustomerReschedules,
            }),
            version: { increment: 1 },
          },
        });
        if (count === 0) throw versionConflict('business');
        const after = await tx.tenant.findUniqueOrThrow({ where: { id: actor.tenantId } });
        const setup = await setupStatus(tx, actor.tenantId);
        const [beforeDto, afterDto] = [toSettings(before, setup), toSettings(after, setup)];
        await recordAudit(tx, auditActor(actor), {
          tenantId: actor.tenantId,
          action: 'tenant.updated',
          entityType: 'tenant',
          entityId: actor.tenantId,
          before: { name: beforeDto.name, bookingSettings: beforeDto.bookingSettings },
          after: { name: afterDto.name, bookingSettings: afterDto.bookingSettings },
        });
        return afterDto;
      }),
  };
}

export type TenantService = ReturnType<typeof createTenantService>;
