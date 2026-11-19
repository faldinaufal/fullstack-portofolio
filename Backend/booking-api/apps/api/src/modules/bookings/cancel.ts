// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { Tx } from '@tempora/db';
import { AppError } from '../../lib/app-error.js';
import { recordAudit, type AuditActor } from '../../lib/audit.js';
import type { PaymentProvider } from '../../lib/payments/provider.js';
import { queueCancelled, type BookingEmailContext } from './emails.js';

export interface CancelOptions {
  now: Date;
  actor: AuditActor;
  /** Recorded on the booking (FSD 6.7). */
  by: { type: 'customer' | 'guest' | 'owner' | 'manager'; id: string | null };
  /** Customers and guests may only cancel unpaid bookings; the team may cancel paid ones. */
  allowPaid: boolean;
  reason: string | undefined;
  /** Email the customer: when the business cancels (FSD 3.8), not when they did it. */
  notify: BookingEmailContext | null;
}

export const notCancellable = (allowPaid: boolean) =>
  new AppError({
    status: 409,
    code: 'NOT_CANCELLABLE',
    title: 'Booking cannot be cancelled',
    detail: allowPaid
      ? 'Only bookings waiting for payment, or paid bookings that have not started, can be cancelled.'
      : 'Only bookings that are still waiting for payment can be cancelled online. Please contact the business.',
  });

/**
 * FSD 6.7 in one transaction. Unpaid (a hold that has not run out): cancelled, invoice void,
 * pending payments expired, slot free at once. Paid and not started (team only): reason
 * required, cancelled with `refund_handled_externally`, the invoice stays paid. Returns the
 * open Checkout sessions, which the caller closes after the commit (`closeCheckouts`).
 */
export async function cancelBooking(
  tx: Tx,
  bookingId: string,
  options: CancelOptions,
): Promise<{ sessions: string[] }> {
  const { now } = options;
  const booking = await tx.booking.findUniqueOrThrow({
    where: { id: bookingId },
    include: { invoice: true },
  });
  const unpaid =
    booking.status === 'pending_payment' && !!booking.holdExpiresAt && booking.holdExpiresAt > now;
  const paid = booking.status === 'confirmed' && booking.startsAt > now;
  if (!unpaid && !(paid && options.allowPaid)) throw notCancellable(options.allowPaid);

  const reason = options.reason ?? (unpaid ? 'Cancelled before payment' : undefined);
  if (paid && !reason) {
    throw new AppError({
      status: 400,
      code: 'VALIDATION_FAILED',
      title: 'Reason required',
      detail: 'Say why a paid booking is cancelled; the customer sees it in the email.',
      errors: [{ path: 'reason', message: 'Required for a paid booking.' }],
    });
  }

  // The status condition makes a concurrent change (payment, worker, another cancel) win or lose
  // cleanly: only one of them moves the booking out of its current state.
  const { count } = await tx.booking.updateMany({
    where: { id: booking.id, status: booking.status, version: booking.version },
    data: {
      status: 'cancelled',
      cancelledAt: now,
      cancelledByType: options.by.type,
      cancelledById: options.by.id,
      cancelReason: reason ?? null,
      holdExpiresAt: null,
      refundHandledExternally: paid,
      version: { increment: 1 },
    },
  });
  if (count === 0) throw notCancellable(options.allowPaid);

  const invoiceId = booking.invoice!.id;
  const open = await tx.payment.findMany({ where: { invoiceId, status: 'pending' } });
  if (unpaid) {
    await tx.invoice.update({
      where: { id: invoiceId },
      data: { status: 'void', voidedAt: now, voidReason: 'Booking cancelled before payment' },
    });
    await tx.payment.updateMany({
      where: { invoiceId, status: 'pending' },
      data: { status: 'expired' },
    });
  }
  await recordAudit(tx, options.actor, {
    tenantId: booking.tenantId,
    branchId: booking.branchId,
    action: 'booking.cancelled',
    entityType: 'booking',
    entityId: booking.id,
    before: { status: booking.status },
    after: { status: 'cancelled', refundHandledExternally: paid },
    ...(reason && { reason }),
  });
  if (options.notify) {
    await queueCancelled(tx, booking.id, { reason: options.reason ?? null, paid }, options.notify);
  }
  return { sessions: open.map((p) => p.checkoutSessionId) };
}

/**
 * After the commit: close the Checkout so it cannot be paid. If this fails, a payment that
 * still arrives is flagged by the webhook's safety net (FSD 6.4) instead of confirming.
 */
export async function closeCheckouts(payments: PaymentProvider, sessions: string[]) {
  for (const sessionId of sessions) {
    await payments.expireCheckout(sessionId).catch(() => undefined);
  }
}
