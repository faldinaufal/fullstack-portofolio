// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { Tx } from '@tempora/db';

/**
 * Branch queries. Every function runs inside a transaction with the caller's tenant
 * context, so row-level security limits each query to that tenant even without a filter;
 * the explicit `tenantId` conditions keep the queries index-friendly and readable.
 */
export const branchRepository = {
  list: (tx: Tx, tenantId: string, branchId?: string) =>
    tx.branch.findMany({
      where: { tenantId, ...(branchId && { id: branchId }) },
      orderBy: [{ archivedAt: { sort: 'asc', nulls: 'first' } }, { name: 'asc' }],
      include: { _count: { select: { memberships: { where: { status: 'active' } } } } },
    }),

  find: (tx: Tx, tenantId: string, id: string) =>
    tx.branch.findFirst({
      where: { tenantId, id },
      include: { _count: { select: { memberships: { where: { status: 'active' } } } } },
    }),

  create: (
    tx: Tx,
    data: { tenantId: string; name: string; address: string | null; phone: string | null },
  ) =>
    tx.branch.create({
      data,
      include: { _count: { select: { memberships: { where: { status: 'active' } } } } },
    }),

  /** Optimistic lock: updates only when the version still matches. Returns rows changed. */
  updateIfVersion: async (
    tx: Tx,
    id: string,
    version: number,
    data: {
      name?: string | undefined;
      address?: string | null | undefined;
      phone?: string | null | undefined;
    },
  ) =>
    (
      await tx.branch.updateMany({
        where: { id, version },
        data: {
          // Fields left out of the request stay unchanged (undefined is not sent to Prisma).
          ...(data.name !== undefined && { name: data.name }),
          ...(data.address !== undefined && { address: data.address }),
          ...(data.phone !== undefined && { phone: data.phone }),
          version: { increment: 1 },
        },
      })
    ).count,

  archive: (tx: Tx, id: string, now: Date) =>
    tx.branch.update({ where: { id }, data: { archivedAt: now, version: { increment: 1 } } }),

  openingHours: (tx: Tx, branchId: string) =>
    tx.branchOpeningHours.findMany({ where: { branchId }, orderBy: { weekday: 'asc' } }),

  replaceOpeningHours: async (
    tx: Tx,
    tenantId: string,
    branchId: string,
    hours: { weekday: number; opensAt: Date; closesAt: Date }[],
  ) => {
    await tx.branchOpeningHours.deleteMany({ where: { branchId } });
    await tx.branchOpeningHours.createMany({
      data: hours.map((h) => ({ tenantId, branchId, ...h })),
    });
  },

  upcomingClosures: (tx: Tx, branchId: string, today: Date) =>
    tx.branchClosure.findMany({
      where: { branchId, endsOn: { gte: today } },
      orderBy: { startsOn: 'asc' },
    }),

  createClosure: (
    tx: Tx,
    data: { tenantId: string; branchId: string; startsOn: Date; endsOn: Date; reason: string },
  ) => tx.branchClosure.create({ data }),

  findClosure: (tx: Tx, branchId: string, id: string) =>
    tx.branchClosure.findFirst({ where: { branchId, id } }),

  deleteClosure: (tx: Tx, id: string) => tx.branchClosure.delete({ where: { id } }),

  /** Open invitations to a branch are revoked when it is archived. */
  revokeOpenInvitations: (tx: Tx, branchId: string, now: Date) =>
    tx.invitation.updateMany({
      where: { branchId, acceptedAt: null, revokedAt: null },
      data: { revokedAt: now },
    }),
};
