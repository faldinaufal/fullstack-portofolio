// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { CreateTimeOffRequest, MemberDetail, TimeOff, WorkingHours } from '@tempora/contracts';
import { withDbContext, type PrismaClient, type Tx } from '@tempora/db';
import { AppError } from '../../lib/app-error.js';
import { recordAudit } from '../../lib/audit.js';
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
  now = () => new Date(),
}: {
  prisma: PrismaClient;
  now?: () => Date;
}) {
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
  };
}

export type ScheduleService = ReturnType<typeof createScheduleService>;
