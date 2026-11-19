// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { Tx } from '@tempora/db';
import { AppError } from '../../lib/app-error.js';
import { recordAudit, type AuditActor } from '../../lib/audit.js';

/**
 * Rules shared by every write that puts a booking on a therapist's schedule (booking,
 * rescheduling): the same lock, the same release of stale holds and the same errors.
 */

const SLOT_MESSAGES: Record<string, string> = {
  BRANCH_CLOSED: 'The branch is closed on this day.',
  OUTSIDE_OPENING_HOURS: 'This time is outside the branch opening hours.',
  OUTSIDE_WORKING_HOURS: 'The therapist does not work at this time.',
  OFF_GRID: 'Sessions start on the hour or half hour.',
  TOO_SOON: 'This time is too soon to book.',
  TOO_FAR_AHEAD: 'This time is too far ahead to book.',
  THERAPIST_TIME_OFF: 'The therapist is away at this time.',
  SLOT_TAKEN: 'This time was just taken. Please choose another one.',
};

export const slotError = (code: string) =>
  new AppError({
    status: 409,
    code: code as 'SLOT_TAKEN',
    title: 'Time not available',
    detail: SLOT_MESSAGES[code] ?? 'This time cannot be booked.',
  });

/** PostgreSQL rejected an overlapping active booking (exclusion constraint, code 23P01). */
export function isOverlapViolation(error: unknown): boolean {
  const text = `${String(error)} ${JSON.stringify(error, Object.getOwnPropertyNames(error ?? {}))}`;
  return text.includes('23P01') || text.includes('bookings_no_overlap');
}

/**
 * FSD 6.3 step 2: writes to one therapist's schedule happen one at a time. Several therapists
 * (a reschedule to someone else) are locked in ID order, so two such writes can never wait
 * for each other in a circle (deadlock).
 */
export async function lockTherapists(tx: Tx, staffIds: string[]): Promise<void> {
  for (const id of [...new Set(staffIds)].sort()) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${id}, 0))`;
  }
}

/** pending_payment → expired; open invoice → void; pending payments → expired (FSD 7.1–7.3). */
export async function expireBooking(
  tx: Tx,
  booking: { id: string; tenantId: string; branchId: string },
  reason: string,
  actor: AuditActor,
  now: Date,
): Promise<void> {
  const { count } = await tx.booking.updateMany({
    where: { id: booking.id, status: 'pending_payment' },
    data: { status: 'expired', version: { increment: 1 } },
  });
  if (count === 0) return;
  const invoice = await tx.invoice.findUnique({ where: { bookingId: booking.id } });
  if (invoice?.status === 'open') {
    await tx.invoice.update({
      where: { id: invoice.id },
      data: { status: 'void', voidedAt: now, voidReason: reason },
    });
    await tx.payment.updateMany({
      where: { invoiceId: invoice.id, status: 'pending' },
      data: { status: 'expired' },
    });
  }
  await recordAudit(tx, actor, {
    tenantId: booking.tenantId,
    branchId: booking.branchId,
    action: 'booking.expired',
    entityType: 'booking',
    entityId: booking.id,
    after: { status: 'expired' },
    reason,
  });
}

/**
 * FSD 6.3 step 3: releases a therapist's unpaid holds that have run out, so they do not block
 * the new time (the exclusion constraint still sees them as active). The worker does the
 * same for everyone every minute.
 */
export async function expireStaleHolds(tx: Tx, staffId: string, now: Date): Promise<void> {
  const stale = await tx.booking.findMany({
    where: { staffMembershipId: staffId, status: 'pending_payment', holdExpiresAt: { lte: now } },
    select: { id: true, tenantId: true, branchId: true },
  });
  for (const booking of stale) {
    await expireBooking(
      tx,
      booking,
      'Payment hold expired',
      { type: 'system', id: null, label: 'Hold expiry' },
      now,
    );
  }
}
