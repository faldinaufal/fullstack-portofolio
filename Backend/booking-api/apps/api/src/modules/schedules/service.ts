// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import {
  PHOTO_MAX_BYTES,
  type CreateTimeOffRequest,
  type ImageUpload,
  type ImageUploadRequest,
  type MemberDetail,
  type TimeOff,
  type WorkingHours,
} from '@tempora/contracts';
import { withDbContext, type PrismaClient, type Tx } from '@tempora/db';
import { AppError } from '../../lib/app-error.js';
import { recordAudit } from '../../lib/audit.js';
import { createImageUploads } from '../../lib/storage/image-upload.js';
import { imageUrl, type ObjectStorage } from '../../lib/storage/storage.js';
import { auditActor, fromWallTime, toWallTime } from '../branches/service.js';
import {
  canEditSchedule,
  canManageTimeOff,
  canSeeMember,
  forbidden,
  notFound,
} from '../console-auth/access.js';
import type { ConsoleActor } from '../console-auth/guard.js';
import { teamRepository } from '../team/repository.js';
import { toMember } from '../team/service.js';
import { hoursOutsideOpening, timeOffProblem } from './rules.js';
import { activeBookings, assertNoConflicts, outsideHours } from '../bookings/active.js';
import { lockTherapists } from '../bookings/rules.js';

type MemberRow = NonNullable<Awaited<ReturnType<typeof teamRepository.findMember>>>;

const toTimeOff = (row: {
  id: string;
  startsAt: Date;
  endsAt: Date;
  reason: string | null;
}): TimeOff => ({
  id: row.id,
  startsAt: row.startsAt.toISOString(),
  endsAt: row.endsAt.toISOString(),
  reason: row.reason,
});

const notATherapist = () =>
  new AppError({
    status: 409,
    code: 'NOT_A_THERAPIST',
    title: 'No schedule for this member',
    detail: 'Only active managers and staff at a branch have working hours and services.',
  });

/** Member detail, working hours, services performed and time off (FSD 2.2, 5.4 Team). */
export function createScheduleService({
  prisma,
  timeZone,
  storage = null,
  now = () => new Date(),
}: {
  prisma: PrismaClient;
  /** Platform time zone: working hours are wall-clock times in it. */
  timeZone: string;
  /** Therapist photos (FSD 6.15); without storage, uploads answer `STORAGE_UNAVAILABLE`. */
  storage?: ObjectStorage | null;
  now?: () => Date;
}) {
  const uploads = createImageUploads(storage);
  /** `tenants/<tenant>/staff/<membership>`: one prefix per therapist. */
  const photoPrefix = (actor: ConsoleActor, id: string) => `tenants/${actor.tenantId}/staff/${id}`;

  const inTenant = <T>(actor: ConsoleActor, work: (tx: Tx) => Promise<T>) =>
    withDbContext(prisma, { tenantId: actor.tenantId, teamAccountId: actor.teamAccountId }, work);

  async function visibleMember(tx: Tx, actor: ConsoleActor, id: string) {
    const member = await teamRepository.findMember(tx, actor.tenantId, id);
    if (!member || !canSeeMember(actor, member)) throw notFound('Member');
    return member;
  }

  /** A member whose schedule the actor may edit: active, with a branch (a therapist). */
  async function schedulable(
    tx: Tx,
    actor: ConsoleActor,
    id: string,
    rule: typeof canEditSchedule,
  ) {
    const member = await visibleMember(tx, actor, id);
    if (!rule(actor, member)) throw forbidden('You cannot change this member’s schedule.');
    if (member.status !== 'active' || !member.branchId) throw notATherapist();
    return member as MemberRow & { branchId: string };
  }

  async function detail(tx: Tx, member: MemberRow): Promise<MemberDetail> {
    // Sequential: a transaction has one connection, so parallel queries gain nothing.
    const hours = await tx.staffWorkingHours.findMany({
      where: { membershipId: member.id },
      orderBy: { weekday: 'asc' },
    });
    const services = await tx.staffService.findMany({
      where: { membershipId: member.id, service: { archivedAt: null } },
      include: { service: { select: { id: true, name: true } } },
      orderBy: { service: { name: 'asc' } },
    });
    const timeOff = await tx.staffTimeOff.findMany({
      where: { membershipId: member.id, endsAt: { gte: now() } },
      orderBy: { startsAt: 'asc' },
    });
    return {
      ...toMember(member),
      photoUrl: imageUrl(storage, member.photoKey),
      workingHours: hours.map((h) => ({
        weekday: h.weekday,
        startsAt: toWallTime(h.startsAt),
        endsAt: toWallTime(h.endsAt),
      })),
      services: services.map((s) => s.service),
      timeOff: timeOff.map(toTimeOff),
    };
  }

  return {
    getMember: (actor: ConsoleActor, id: string) =>
      inTenant(actor, async (tx) => detail(tx, await visibleMember(tx, actor, id))),

    /** Replaces the week; each day must fit inside the branch's opening hours that day. */
    replaceWorkingHours: (actor: ConsoleActor, id: string, hours: WorkingHours[]) =>
      inTenant(actor, async (tx) => {
        const member = await schedulable(tx, actor, id, canEditSchedule);
        const opening = await tx.branchOpeningHours.findMany({
          where: { branchId: member.branchId },
        });
        const outside = hoursOutsideOpening(
          hours.map((h) => ({ weekday: h.weekday, start: h.startsAt, end: h.endsAt })),
          opening.map((o) => ({
            weekday: o.weekday,
            start: toWallTime(o.opensAt),
            end: toWallTime(o.closesAt),
          })),
        );
        if (outside.length > 0) {
          throw new AppError({
            status: 409,
            code: 'OUTSIDE_BRANCH_HOURS',
            title: 'Outside opening hours',
            detail: 'Working hours must lie within the branch opening hours of the same day.',
            errors: outside.map((index) => ({
              path: `hours.${index}`,
              message: 'Outside the branch opening hours (or the branch is closed that day).',
            })),
          });
        }
        // FSD 6.8: no booking may be left outside the new hours.
        await lockTherapists(tx, [member.id]);
        assertNoConflicts(
          outsideHours(
            await activeBookings(tx, { staffMembershipId: member.id }, now()),
            hours.map((h) => ({ weekday: h.weekday, start: h.startsAt, end: h.endsAt })),
            timeZone,
          ),
          'Some bookings fall outside the new working hours.',
        );
        const before = await detail(tx, member);
        await tx.staffWorkingHours.deleteMany({ where: { membershipId: id } });
        await tx.staffWorkingHours.createMany({
          data: hours.map((h) => ({
            tenantId: actor.tenantId,
            membershipId: id,
            weekday: h.weekday,
            startsAt: fromWallTime(h.startsAt),
            endsAt: fromWallTime(h.endsAt),
          })),
        });
        const after = await detail(tx, member);
        await recordAudit(tx, auditActor(actor), {
          tenantId: actor.tenantId,
          branchId: member.branchId,
          action: 'membership.working_hours_replaced',
          entityType: 'membership',
          entityId: id,
          before: before.workingHours,
          after: after.workingHours,
        });
        return after;
      }),

    /** Replaces the services the therapist performs; each must be an active service. */
    replaceServices: (actor: ConsoleActor, id: string, serviceIds: string[]) =>
      inTenant(actor, async (tx) => {
        const member = await schedulable(tx, actor, id, canEditSchedule);
        const unique = [...new Set(serviceIds)];
        const found = await tx.service.count({
          where: { tenantId: actor.tenantId, id: { in: unique }, archivedAt: null },
        });
        if (found !== unique.length) throw notFound('Service');
        const before = await detail(tx, member);
        await tx.staffService.deleteMany({ where: { membershipId: id } });
        await tx.staffService.createMany({
          data: unique.map((serviceId) => ({
            tenantId: actor.tenantId,
            membershipId: id,
            serviceId,
          })),
        });
        const after = await detail(tx, member);
        await recordAudit(tx, auditActor(actor), {
          tenantId: actor.tenantId,
          branchId: member.branchId,
          action: 'membership.services_replaced',
          entityType: 'membership',
          entityId: id,
          before: before.services,
          after: after.services,
        });
        return after;
      }),

    listTimeOff: (actor: ConsoleActor, id: string) =>
      inTenant(actor, async (tx) => {
        const member = await visibleMember(tx, actor, id);
        if (!canManageTimeOff(actor, member)) throw notFound('Member');
        const rows = await tx.staffTimeOff.findMany({
          where: { membershipId: id, endsAt: { gte: now() } },
          orderBy: { startsAt: 'asc' },
        });
        return { items: rows.map(toTimeOff) };
      }),

    /**
     * Adds time off. Overlaps with active bookings will be rejected once bookings exist
     * (FSD 6.8, same advisory lock as bookings).
     */
    addTimeOff: (actor: ConsoleActor, id: string, input: CreateTimeOffRequest) =>
      inTenant(actor, async (tx) => {
        const member = await schedulable(tx, actor, id, canManageTimeOff);
        const startsAt = new Date(input.startsAt);
        const endsAt = new Date(input.endsAt);
        const problem = timeOffProblem(startsAt, endsAt, now());
        if (problem) {
          throw new AppError({
            status: 400,
            code: 'VALIDATION_FAILED',
            title: 'Invalid request',
            detail: problem,
            errors: [{ path: 'endsAt', message: problem }],
          });
        }
        // FSD 6.8: time off cannot overlap a booking (buffer included), under the booking lock.
        await lockTherapists(tx, [member.id]);
        assertNoConflicts(
          await activeBookings(
            tx,
            {
              staffMembershipId: member.id,
              startsAt: { lt: endsAt },
              blockedUntil: { gt: startsAt },
            },
            now(),
          ),
          'The time off overlaps bookings.',
        );
        const created = await tx.staffTimeOff.create({
          data: {
            tenantId: actor.tenantId,
            membershipId: id,
            startsAt,
            endsAt,
            reason: input.reason?.length ? input.reason : null,
            createdByMembershipId: actor.membershipId,
          },
        });
        const dto = toTimeOff(created);
        await recordAudit(tx, auditActor(actor), {
          tenantId: actor.tenantId,
          branchId: member.branchId,
          action: 'time_off.created',
          entityType: 'time_off',
          entityId: created.id,
          after: dto,
        });
        return dto;
      }),

    removeTimeOff: (actor: ConsoleActor, id: string, timeOffId: string) =>
      inTenant(actor, async (tx) => {
        const member = await schedulable(tx, actor, id, canManageTimeOff);
        const row = await tx.staffTimeOff.findFirst({ where: { id: timeOffId, membershipId: id } });
        if (!row) throw notFound('Time off');
        await tx.staffTimeOff.delete({ where: { id: timeOffId } });
        await recordAudit(tx, auditActor(actor), {
          tenantId: actor.tenantId,
          branchId: member.branchId,
          action: 'time_off.removed',
          entityType: 'time_off',
          entityId: timeOffId,
          before: toTimeOff(row),
        });
      }),

    /**
     * Therapist photo (FSD 6.15): the same people who manage the therapist's time off
     * (owner, the branch manager, the therapist). Signing needs no database work, but the
     * access check does, so it runs in the tenant context first.
     */
    requestPhotoUpload: async (
      actor: ConsoleActor,
      id: string,
      input: ImageUploadRequest,
    ): Promise<ImageUpload> => {
      await inTenant(actor, (tx) => schedulable(tx, actor, id, canManageTimeOff));
      return uploads.presign(photoPrefix(actor, id), PHOTO_MAX_BYTES, input);
    },

    confirmPhoto: async (actor: ConsoleActor, id: string, key: string) => {
      await inTenant(actor, (tx) => schedulable(tx, actor, id, canManageTimeOff));
      await uploads.verify(photoPrefix(actor, id), PHOTO_MAX_BYTES, key);
      return setPhoto(actor, id, key);
    },

    removePhoto: (actor: ConsoleActor, id: string) => setPhoto(actor, id, null),
  };

  /**
   * Swaps the photo key with its audit entry, then deletes the replaced file. A photo has no
   * version check: two people replacing the same photo at once simply leave the later one.
   */
  async function setPhoto(actor: ConsoleActor, id: string, key: string | null) {
    const { result, replaced } = await inTenant(actor, async (tx) => {
      const member = await schedulable(tx, actor, id, canManageTimeOff);
      await tx.membership.update({ where: { id }, data: { photoKey: key } });
      await recordAudit(tx, auditActor(actor), {
        tenantId: actor.tenantId,
        branchId: member.branchId,
        action: 'membership.photo_changed',
        entityType: 'membership',
        entityId: id,
        before: { photo: member.photoKey },
        after: { photo: key },
      });
      const updated = await visibleMember(tx, actor, id);
      return { result: await detail(tx, updated), replaced: member.photoKey };
    });
    if (replaced !== key) await uploads.discard(replaced);
    return result;
  }
}

export type ScheduleService = ReturnType<typeof createScheduleService>;
