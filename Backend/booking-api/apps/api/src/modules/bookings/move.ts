// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { Tx } from '@tempora/db';
import { AppError } from '../../lib/app-error.js';
import { recordAudit, type AuditActor } from '../../lib/audit.js';
import { calendarDateOf, slotProblem } from '../availability/engine.js';
import { loadAvailabilityInput } from '../availability/load.js';
import { displayName } from '../public/service.js';
import { queueRescheduled, type BookingEmailContext } from './emails.js';
import { expireStaleHolds, lockTherapists, slotError } from './rules.js';

const MINUTE = 60_000;

/** The booking as read under the lock, for the caller's own checks. */
export type LockedBooking = Awaited<ReturnType<typeof readLocked>>;

const readLocked = (tx: Tx, id: string) =>
  tx.booking.findUniqueOrThrow({
    where: { id },
    include: {
      tenant: true,
      tenantCustomer: true,
      staff: { include: { teamAccount: { select: { name: true } } } },
    },
  });

export interface MoveOptions {
  timeZone: string;
  now: Date;
  emails: BookingEmailContext;
  actor: AuditActor;
  /** Customer reschedules count against their limit; the team's do not (FSD 6.5). */
  byCustomer: boolean;
  action: 'booking.rescheduled' | 'booking.reassigned';
  /** Runs under the lock on the freshly read booking; throws to refuse (e.g. FSD 6.5 rules). */
  check: (booking: LockedBooking) => void;
}

/**
 * Moves a booking in place, to a new time and/or therapist (FSD 6.5, 6.6): same invoice and
 * payment. Both therapists are locked in ID order, every rule of 6.2 is checked again with
 * the booking's own duration and buffer (its own time is not counted as taken), and the
 * exclusion constraint stays the last line of defence (callers map it to `SLOT_TAKEN`).
 * The lead time is a rule for customers; the team may move a booking until it starts.
 */
export async function moveBooking(
  tx: Tx,
  bookingId: string,
  target: { startsAt: Date; staffId?: string | undefined },
  options: MoveOptions,
): Promise<void> {
  const { now, timeZone } = options;
  const current = await tx.booking.findUniqueOrThrow({ where: { id: bookingId } });
  const staffId = target.staffId ?? current.staffMembershipId;
  await lockTherapists(tx, [current.staffMembershipId, staffId]);
  // Re-read under the lock: a concurrent change may have moved it meanwhile.
  const booking = await readLocked(tx, bookingId);
  options.check(booking);
  const { startsAt } = target;
  if (booking.startsAt.getTime() === startsAt.getTime() && booking.staffMembershipId === staffId) {
    throw new AppError({
      status: 400,
      code: 'VALIDATION_FAILED',
      title: 'No change',
      detail: 'Choose a different time or therapist.',
      errors: [{ path: 'startsAt', message: 'This is the current time and therapist.' }],
    });
  }
  await expireStaleHolds(tx, staffId, now);

  const { input } = await loadAvailabilityInput(
    tx,
    {
      branchId: booking.branchId,
      serviceId: booking.serviceId,
      staffId,
      date: calendarDateOf(startsAt, timeZone),
      excludeBookingId: booking.id,
    },
    {
      timeZone,
      now,
      settings: {
        minLeadHours: options.byCustomer ? booking.tenant.minLeadHours : 0,
        maxAdvanceDays: booking.tenant.maxAdvanceDays,
      },
    },
  );
  const problem = slotProblem(
    {
      ...input,
      service: { durationMinutes: booking.durationMinutes, bufferMinutes: booking.bufferMinutes },
    },
    startsAt,
  );
  if (problem) throw slotError(problem);

  const endsAt = new Date(startsAt.getTime() + booking.durationMinutes * MINUTE);
  await tx.booking.update({
    where: { id: booking.id },
    data: {
      startsAt,
      endsAt,
      blockedUntil: new Date(endsAt.getTime() + booking.bufferMinutes * MINUTE),
      staffMembershipId: staffId,
      ...(options.byCustomer && { customerRescheduleCount: { increment: 1 } }),
      version: { increment: 1 },
    },
  });
  await recordAudit(tx, options.actor, {
    tenantId: booking.tenantId,
    branchId: booking.branchId,
    action: options.action,
    entityType: 'booking',
    entityId: booking.id,
    before: { startsAt: booking.startsAt, staffId: booking.staffMembershipId },
    after: { startsAt, staffId },
  });
  await queueRescheduled(
    tx,
    booking.id,
    {
      startsAt: booking.startsAt,
      therapist: displayName(booking.staff.teamAccount.name),
    },
    options.emails,
    now,
  );
}
