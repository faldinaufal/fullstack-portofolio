// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type {
  Availability,
  AvailabilityQuery,
  Directory,
  PublicBranchDetail,
  PublicTenant,
} from '@tempora/contracts';
import { withDbContext, type PrismaClient, type Tx } from '@tempora/db';
import { AppError } from '../../lib/app-error.js';
import { toDateOnly, toWallTime } from '../branches/service.js';
import { notFound } from '../console-auth/access.js';
import { availableSlots, todayIn, wallTimeToInstant, weekdayOf } from '../availability/engine.js';

/** "Daniel Kim" → "Daniel K.": enough for customers to choose, without the full name. */
export function displayName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts.at(-1)![0]}.` : (parts[0] ?? '');
}

/** Escapes LIKE wildcards so a visitor's `%` or `_` is searched literally. */
export const escapeLike = (value: string) => value.replace(/[\\%_]/g, (char) => `\\${char}`);

const tenantSuspended = () =>
  new AppError({
    status: 423,
    code: 'TENANT_SUSPENDED',
    title: 'Business temporarily unavailable',
    detail: 'This business is not taking bookings at the moment.',
  });

export interface PublicCatalogueDeps {
  prisma: PrismaClient;
  /** Platform time zone (FSD 4.1 `APP_TIME_ZONE`). */
  timeZone: string;
  now?: () => Date;
}

/**
 * Portal pages before login (FSD 2.1, 5.2). Data of one business is read inside that
 * business's tenant context, exactly like the Console (FSD 4.4: "the tenant whose public page
 * the Portal request targets"); only public columns leave this module.
 */
export function createPublicCatalogue({
  prisma,
  timeZone,
  now = () => new Date(),
}: PublicCatalogueDeps) {
  /** The tenant behind a slug, if it is public: not archived and bookable. */
  async function publicTenant(slug: string) {
    const tenant = await prisma.tenant.findFirst({ where: { slug, archivedAt: null } });
    if (!tenant) throw notFound('Business');
    const [row] = await prisma.$queryRaw<{ bookable: boolean }[]>`
      SELECT tenant_is_bookable(${tenant.id}::uuid) AS bookable
    `;
    if (!row?.bookable) throw notFound('Business');
    return tenant;
  }

  const inTenant = <T>(tenantId: string, work: (tx: Tx) => Promise<T>) =>
    withDbContext(prisma, { tenantId }, work);

  const today = () => new Date(`${todayIn(timeZone, now())}T00:00:00.000Z`);

  /** Active therapists of a branch who have working hours and perform an active service. */
  const bookableTherapists = (tx: Tx, branchId: string) =>
    tx.membership.findMany({
      where: {
        branchId,
        status: 'active',
        workingHours: { some: {} },
        services: { some: { service: { archivedAt: null } } },
      },
      include: {
        teamAccount: { select: { name: true } },
        services: { where: { service: { archivedAt: null } }, select: { serviceId: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

  const toPublicService = (s: {
    id: string;
    name: string;
    description: string | null;
    durationMinutes: number;
    priceCents: number;
  }) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    durationMinutes: s.durationMinutes,
    priceCents: s.priceCents,
  });

  async function publicBranches(tx: Tx, tenantId: string) {
    const branches = await tx.branch.findMany({
      where: { tenantId, archivedAt: null },
      include: {
        openingHours: { orderBy: { weekday: 'asc' } },
        closures: { where: { endsOn: { gte: today() } }, orderBy: { startsOn: 'asc' } },
      },
      orderBy: { name: 'asc' },
    });
    return branches.map((branch) => ({
      id: branch.id,
      name: branch.name,
      address: branch.address,
      phone: branch.phone,
      openingHours: branch.openingHours.map((h) => ({
        weekday: h.weekday,
        opensAt: toWallTime(h.opensAt),
        closesAt: toWallTime(h.closesAt),
      })),
      closures: branch.closures.map((c) => ({
        startsOn: toDateOnly(c.startsOn),
        endsOn: toDateOnly(c.endsOn),
        reason: c.reason,
      })),
    }));
  }

  return {
    async directory(query: string | undefined): Promise<Directory> {
      const pattern = query ? escapeLike(query) : null;
      const rows = await prisma.$queryRaw<
        { slug: string; name: string; branch_names: string[]; service_names: string[] }[]
      >`SELECT * FROM public_directory(${pattern}, 50)`;
      return {
        items: rows.map((row) => ({
          slug: row.slug,
          name: row.name,
          branchNames: row.branch_names,
          serviceNames: row.service_names,
        })),
      };
    },

    async tenant(slug: string): Promise<PublicTenant> {
      const tenant = await publicTenant(slug);
      return inTenant(tenant.id, async (tx) => {
        // Only services someone can actually perform are shown.
        const services = await tx.service.findMany({
          where: {
            tenantId: tenant.id,
            archivedAt: null,
            staffServices: { some: { membership: { status: 'active' } } },
          },
          orderBy: { name: 'asc' },
        });
        return {
          slug: tenant.slug,
          name: tenant.name,
          available: tenant.status === 'active',
          timeZone,
          maxAdvanceDays: tenant.maxAdvanceDays,
          branches: await publicBranches(tx, tenant.id),
          services: services.map(toPublicService),
        };
      });
    },

    async branch(slug: string, branchId: string): Promise<PublicBranchDetail> {
      const tenant = await publicTenant(slug);
      return inTenant(tenant.id, async (tx) => {
        const branch = (await publicBranches(tx, tenant.id)).find((b) => b.id === branchId);
        if (!branch) throw notFound('Branch');
        const therapists = await bookableTherapists(tx, branchId);
        const serviceIds = [
          ...new Set(therapists.flatMap((t) => t.services.map((s) => s.serviceId))),
        ];
        const services = await tx.service.findMany({
          where: { id: { in: serviceIds }, archivedAt: null },
          orderBy: { name: 'asc' },
        });
        return {
          ...branch,
          tenant: { slug: tenant.slug, name: tenant.name, available: tenant.status === 'active' },
          therapists: therapists.map((t) => ({
            id: t.id,
            displayName: displayName(t.teamAccount.name),
            serviceIds: t.services.map((s) => s.serviceId),
          })),
          services: services.map(toPublicService),
        };
      });
    },

    /**
     * Free start times for one therapist, service and day (FSD 6.2). The same rules run again
     * inside the booking transaction (stage 5), because availability can change between
     * viewing and booking.
     */
    async availability(slug: string, query: AvailabilityQuery): Promise<Availability> {
      const tenant = await publicTenant(slug);
      if (tenant.status !== 'active') throw tenantSuspended();

      return inTenant(tenant.id, async (tx) => {
        // Rule 1: branch and service active, therapist active at the branch and performs it.
        const [branch, service, therapist] = await Promise.all([
          tx.branch.findFirst({ where: { id: query.branchId, archivedAt: null } }),
          tx.service.findFirst({ where: { id: query.serviceId, archivedAt: null } }),
          tx.membership.findFirst({
            where: { id: query.staffId, branchId: query.branchId, status: 'active' },
            include: { services: { where: { serviceId: query.serviceId } } },
          }),
        ]);
        if (!branch || !service || !therapist) throw notFound('Branch, service or therapist');
        if (therapist.services.length === 0) {
          throw new AppError({
            status: 409,
            code: 'SERVICE_NOT_OFFERED',
            title: 'Service not offered',
            detail: 'This therapist does not perform this service.',
          });
        }

        const weekday = weekdayOf(query.date);
        const day = new Date(`${query.date}T00:00:00.000Z`);
        const dayStart = wallTimeToInstant(query.date, 0, timeZone) ?? day;
        const nextDay = new Date(day.getTime() + 24 * 60 * 60_000).toISOString().slice(0, 10);
        const dayEnd =
          wallTimeToInstant(nextDay, 0, timeZone) ??
          new Date(dayStart.getTime() + 24 * 60 * 60_000);

        const [opening, working, closure, timeOff] = await Promise.all([
          tx.branchOpeningHours.findFirst({ where: { branchId: branch.id, weekday } }),
          tx.staffWorkingHours.findFirst({ where: { membershipId: therapist.id, weekday } }),
          tx.branchClosure.findFirst({
            where: { branchId: branch.id, startsOn: { lte: day }, endsOn: { gte: day } },
          }),
          tx.staffTimeOff.findMany({
            where: {
              membershipId: therapist.id,
              startsAt: { lt: new Date(dayEnd.getTime() + service.bufferMinutes * 60_000) },
              endsAt: { gt: dayStart },
            },
          }),
        ]);

        const slots = availableSlots({
          date: query.date,
          timeZone,
          now: now(),
          settings: { minLeadHours: tenant.minLeadHours, maxAdvanceDays: tenant.maxAdvanceDays },
          service: {
            durationMinutes: service.durationMinutes,
            bufferMinutes: service.bufferMinutes,
          },
          opening: opening
            ? { start: toWallTime(opening.opensAt), end: toWallTime(opening.closesAt) }
            : null,
          working: working
            ? { start: toWallTime(working.startsAt), end: toWallTime(working.endsAt) }
            : null,
          closed: closure !== null,
          // Active bookings join this list in stage 5 (FSD 6.2 rule 5).
          busy: timeOff.map((t) => ({ start: t.startsAt, end: t.endsAt })),
        });

        return {
          date: query.date,
          timeZone,
          slots: slots.map((slot) => ({
            startsAt: slot.startsAt.toISOString(),
            endsAt: slot.endsAt.toISOString(),
          })),
        };
      });
    },
  };
}

export type PublicCatalogue = ReturnType<typeof createPublicCatalogue>;
