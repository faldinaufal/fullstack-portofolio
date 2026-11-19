// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { CreateServiceRequest, Service, UpdateServiceRequest } from '@tempora/contracts';
import { withDbContext, type PrismaClient, type Tx } from '@tempora/db';
import { AppError } from '../../lib/app-error.js';
import { recordAudit } from '../../lib/audit.js';
import { activeBookings, assertNoConflicts } from '../bookings/active.js';
import { lockTherapists } from '../bookings/rules.js';
import { versionConflict } from '../../lib/route-schemas.js';
import { auditActor } from '../branches/service.js';
import { notFound } from '../console-auth/access.js';
import type { ConsoleActor } from '../console-auth/guard.js';

const withTherapists = {
  _count: {
    select: { staffServices: { where: { membership: { status: 'active' as const } } } },
  },
} as const;

type ServiceRow = NonNullable<Awaited<ReturnType<typeof findService>>>;

const findService = (tx: Tx, tenantId: string, id: string) =>
  tx.service.findFirst({ where: { tenantId, id }, include: withTherapists });

function toService(row: ServiceRow): Service {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    durationMinutes: row.durationMinutes,
    bufferMinutes: row.bufferMinutes,
    priceCents: row.priceCents,
    archived: row.archivedAt !== null,
    version: row.version,
    therapists: row._count.staffServices,
  };
}

/**
 * Tenant-wide catalogue (FSD 2.2 Services, 5.4). A price change affects new bookings only:
 * bookings keep a snapshot of name, duration, buffer and price (FSD 4.1).
 */
export function createServiceCatalogue({ prisma }: { prisma: PrismaClient }) {
  const inTenant = <T>(actor: ConsoleActor, work: (tx: Tx) => Promise<T>) =>
    withDbContext(prisma, { tenantId: actor.tenantId, teamAccountId: actor.teamAccountId }, work);

  async function activeService(tx: Tx, actor: ConsoleActor, id: string) {
    const service = await findService(tx, actor.tenantId, id);
    if (!service) throw notFound('Service');
    if (service.archivedAt) {
      throw new AppError({
        status: 409,
        code: 'VALIDATION_FAILED',
        title: 'Service archived',
        detail: 'An archived service cannot be changed.',
      });
    }
    return service;
  }

  return {
    list: (actor: ConsoleActor) =>
      inTenant(actor, async (tx) => {
        const rows = await tx.service.findMany({
          where: { tenantId: actor.tenantId },
          include: withTherapists,
          orderBy: [{ archivedAt: { sort: 'asc', nulls: 'first' } }, { name: 'asc' }],
        });
        return { items: rows.map(toService) };
      }),

    create: (actor: ConsoleActor, input: CreateServiceRequest) =>
      inTenant(actor, async (tx) => {
        const created = await tx.service.create({
          data: {
            tenantId: actor.tenantId,
            name: input.name,
            description: input.description ?? null,
            durationMinutes: input.durationMinutes,
            bufferMinutes: input.bufferMinutes,
            priceCents: input.priceCents,
          },
          include: withTherapists,
        });
        const dto = toService(created);
        await recordAudit(tx, auditActor(actor), {
          tenantId: actor.tenantId,
          action: 'service.created',
          entityType: 'service',
          entityId: created.id,
          after: dto,
        });
        return dto;
      }),

    update: (actor: ConsoleActor, id: string, version: number, input: UpdateServiceRequest) =>
      inTenant(actor, async (tx) => {
        const before = await activeService(tx, actor, id);
        const { count } = await tx.service.updateMany({
          where: { id, version },
          data: {
            ...(input.name !== undefined && { name: input.name }),
            ...(input.description !== undefined && { description: input.description }),
            ...(input.durationMinutes !== undefined && { durationMinutes: input.durationMinutes }),
            ...(input.bufferMinutes !== undefined && { bufferMinutes: input.bufferMinutes }),
            ...(input.priceCents !== undefined && { priceCents: input.priceCents }),
            version: { increment: 1 },
          },
        });
        if (count === 0) throw versionConflict('service');
        const after = toService((await findService(tx, actor.tenantId, id))!);
        await recordAudit(tx, auditActor(actor), {
          tenantId: actor.tenantId,
          action: 'service.updated',
          entityType: 'service',
          entityId: id,
          before: toService(before),
          after,
        });
        return after;
      }),

    /**
     * Archive: hidden from booking, kept for past bookings. Therapists stop offering it.
     * Future bookings will block it once bookings exist (FSD 6.8).
     */
    archive: (actor: ConsoleActor, id: string) =>
      inTenant(actor, async (tx) => {
        const before = await activeService(tx, actor, id);
        // FSD 6.8: lock everyone who performs it, then refuse while bookings are coming up.
        const performers = await tx.staffService.findMany({ where: { serviceId: id } });
        await lockTherapists(
          tx,
          performers.map((p) => p.membershipId),
        );
        assertNoConflicts(
          await activeBookings(tx, { serviceId: id }, new Date()),
          'The service has upcoming bookings.',
        );
        await tx.service.update({
          where: { id },
          data: { archivedAt: new Date(), version: { increment: 1 } },
        });
        await tx.staffService.deleteMany({ where: { serviceId: id } });
        const after = toService((await findService(tx, actor.tenantId, id))!);
        await recordAudit(tx, auditActor(actor), {
          tenantId: actor.tenantId,
          action: 'service.archived',
          entityType: 'service',
          entityId: id,
          before: toService(before),
          after,
        });
        return after;
      }),
  };
}

export type ServiceCatalogue = ReturnType<typeof createServiceCatalogue>;
