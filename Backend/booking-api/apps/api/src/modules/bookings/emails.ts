// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { Tx } from '@tempora/db';
import type { BookingEmailDetails } from '@tempora/db/emails';
import type { TokenHasher } from '../../lib/tokens.js';
import { displayName } from '../public/service.js';
import { issueAccessToken } from './access.js';

/** FSD 6.1: the reminder goes out 24 hours before the session. */
export const REMINDER_BEFORE_MS = 24 * 60 * 60_000;

export interface BookingEmailContext {
  hashToken: TokenHasher;
  portalUrl: string;
  timeZone: string;
}

/** "Monday 23 November 2026 at 10:00" in the platform time zone. */
export const formatWhen = (instant: Date, timeZone: string) =>
  new Intl.DateTimeFormat('en-GB', { dateStyle: 'full', timeStyle: 'short', timeZone }).format(
    instant,
  );

/**
 * The booking as every booking email describes it. The link goes to My bookings when the
 * customer record belongs to a (verified) account, else to a fresh guest link: each email
 * carries its own token, erased from the outbox once sent.
 */
async function describe(tx: Tx, bookingId: string, context: BookingEmailContext) {
  const booking = await tx.booking.findUniqueOrThrow({
    where: { id: bookingId },
    include: {
      tenant: true,
      branch: true,
      tenantCustomer: true,
      invoice: true,
      staff: { include: { teamAccount: true } },
    },
  });
  const details: BookingEmailDetails = {
    name: booking.tenantCustomer.name,
    businessName: booking.tenant.name,
    serviceName: booking.serviceName,
    therapist: displayName(booking.staff.teamAccount.name),
    when: formatWhen(booking.startsAt, context.timeZone),
    branchName: booking.branch.name,
    address: booking.branch.address,
    bookingUrl: booking.tenantCustomer.customerAccountId
      ? `${context.portalUrl}/account/bookings/${booking.id}`
      : `${context.portalUrl}/manage/${await issueAccessToken(tx, context.hashToken, booking)}`,
  };
  return { booking, details };
}

/**
 * Queues the reminder for the booking's current time (FSD 6.1, 6.5). It waits in the outbox
 * until 24 h before the session and names the start time it was written for, so the worker
 * skips it if the booking is cancelled or moved meanwhile. None when the session is less
 * than 24 h after `reference` (booking created, or rescheduled, that close to it).
 */
async function queueReminder(
  tx: Tx,
  booking: { id: string; tenantId: string; startsAt: Date },
  to: string,
  details: BookingEmailDetails,
  reference: Date,
): Promise<void> {
  const due = new Date(booking.startsAt.getTime() - REMINDER_BEFORE_MS);
  if (due <= reference) return;
  await tx.emailMessage.create({
    data: {
      tenantId: booking.tenantId,
      toEmail: to,
      template: 'portal.booking_reminder',
      payload: { ...details },
      nextAttemptAt: due,
      bookingId: booking.id,
      bookingStartsAt: booking.startsAt,
    },
  });
}

/**
 * After payment: the confirmation now, the reminder later. `now` is the confirmation time,
 * at most 30 minutes after the booking was made (the payment window).
 */
export async function queueConfirmation(
  tx: Tx,
  bookingId: string,
  context: BookingEmailContext,
  now: Date,
): Promise<void> {
  const { booking, details } = await describe(tx, bookingId, context);
  const to = booking.tenantCustomer.email;
  await tx.emailMessage.create({
    data: {
      tenantId: booking.tenantId,
      toEmail: to,
      template: 'portal.booking_confirmed',
      payload: {
        ...details,
        invoiceNumber: booking.invoice?.number ?? '',
        priceCents: booking.priceCents,
      },
    },
  });
  await queueReminder(tx, booking, to, details, now);
}

/**
 * After a reschedule or a new therapist: "booking moved" now (new and previous time and
 * therapist), and for a paid booking a reminder for the new time. An unpaid booking gets its
 * reminder when it is paid, so it never has two that match.
 */
export async function queueRescheduled(
  tx: Tx,
  bookingId: string,
  previous: { startsAt: Date; therapist: string },
  context: BookingEmailContext,
  now: Date,
): Promise<void> {
  const { booking, details } = await describe(tx, bookingId, context);
  const to = booking.tenantCustomer.email;
  await tx.emailMessage.create({
    data: {
      tenantId: booking.tenantId,
      toEmail: to,
      template: 'portal.booking_rescheduled',
      payload: {
        ...details,
        previousWhen: formatWhen(previous.startsAt, context.timeZone),
        previousTherapist: previous.therapist,
      },
    },
  });
  if (booking.status === 'confirmed') await queueReminder(tx, booking, to, details, now);
}

/** The business cancelled: tell the customer why, and who refunds a paid booking (FSD 6.7). */
export async function queueCancelled(
  tx: Tx,
  bookingId: string,
  cancellation: { reason: string | null; paid: boolean },
  context: BookingEmailContext,
): Promise<void> {
  const { booking, details } = await describe(tx, bookingId, context);
  await tx.emailMessage.create({
    data: {
      tenantId: booking.tenantId,
      toEmail: booking.tenantCustomer.email,
      template: 'portal.booking_cancelled',
      payload: { ...details, reason: cancellation.reason, refundByBusiness: cancellation.paid },
    },
  });
}
