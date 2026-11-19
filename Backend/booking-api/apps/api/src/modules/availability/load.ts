// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { Tx } from '@tempora/db';
import { AppError } from '../../lib/app-error.js';
import { toWallTime } from '../branches/service.js';
import { notFound } from '../console-auth/access.js';
import { wallTimeToInstant, weekdayOf, type AvailabilityInput } from './engine.js';

const MINUTE = 60_000;

export interface SlotRequest {
  branchId: string;
  serviceId: string;
  staffId: string;
  /** Calendar date in the business time zone, `YYYY-MM-DD`. */
  date: string;
}

/**
 * Loads everything the slot engine needs for one therapist on one day (FSD 6.2 rule 1, then
 * the data for rules 2–5). The availability endpoint and booking creation both call this,
 * so a slot that is offered is checked against exactly the same data when it is booked.
 *
 * The queries run one after another on purpose: inside a transaction they share a single
 * connection, so running them "in parallel" gains nothing and the pg driver rejects it.
 */
export async function loadAvailabilityInput(
  tx: Tx,
  request: SlotRequest,
  context: {
    timeZone: string;
    now: Date;
    settings: AvailabilityInput['settings'];
  },
) {
  const { timeZone, now } = context;
  const branch = await tx.branch.findFirst({ where: { id: request.branchId, archivedAt: null } });
  const service = await tx.service.findFirst({
    where: { id: request.serviceId, archivedAt: null },
  });
  const therapist = await tx.membership.findFirst({
    where: { id: request.staffId, branchId: request.branchId, status: 'active' },
    include: { services: { where: { serviceId: request.serviceId } } },
  });
  if (!branch || !service || !therapist) throw notFound('Branch, service or therapist');
  if (therapist.services.length === 0) {
    throw new AppError({
      status: 409,
      code: 'SERVICE_NOT_OFFERED',
      title: 'Service not offered',
      detail: 'This therapist does not perform this service.',
    });
  }

  const weekday = weekdayOf(request.date);
  const day = new Date(`${request.date}T00:00:00.000Z`);
  const dayStart = wallTimeToInstant(request.date, 0, timeZone) ?? day;
  const nextDay = new Date(day.getTime() + 24 * 60 * MINUTE).toISOString().slice(0, 10);
  const dayEnd =
    wallTimeToInstant(nextDay, 0, timeZone) ?? new Date(dayStart.getTime() + 24 * 60 * MINUTE);

  const opening = await tx.branchOpeningHours.findFirst({
    where: { branchId: branch.id, weekday },
  });
  const working = await tx.staffWorkingHours.findFirst({
    where: { membershipId: therapist.id, weekday },
  });
  const closure = await tx.branchClosure.findFirst({
    where: { branchId: branch.id, startsOn: { lte: day }, endsOn: { gte: day } },
  });
  const timeOff = await tx.staffTimeOff.findMany({
    where: {
      membershipId: therapist.id,
      startsAt: { lt: new Date(dayEnd.getTime() + service.bufferMinutes * MINUTE) },
      endsAt: { gt: dayStart },
    },
  });
  // Active bookings: confirmed, or awaiting payment with a hold that has not run out.
  const active = await tx.booking.findMany({
    where: {
      staffMembershipId: therapist.id,
      startsAt: { lt: dayEnd },
      blockedUntil: { gt: dayStart },
      OR: [{ status: 'confirmed' }, { status: 'pending_payment', holdExpiresAt: { gt: now } }],
    },
    select: { startsAt: true, blockedUntil: true },
  });

  const input: AvailabilityInput = {
    date: request.date,
    timeZone,
    now,
    settings: context.settings,
    service: { durationMinutes: service.durationMinutes, bufferMinutes: service.bufferMinutes },
    opening: opening
      ? { start: toWallTime(opening.opensAt), end: toWallTime(opening.closesAt) }
      : null,
    working: working
      ? { start: toWallTime(working.startsAt), end: toWallTime(working.endsAt) }
      : null,
    closed: closure !== null,
    timeOff: timeOff.map((t) => ({ start: t.startsAt, end: t.endsAt })),
    bookings: active.map((b) => ({ start: b.startsAt, end: b.blockedUntil })),
  };
  return { input, branch, service, therapist };
}
