// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { Scope } from '../console-auth/access.js';

/**
 * Who may do what with a booking in the Console (FSD 1.2 "Bookings", 6.5–6.7). Pure functions,
 * unit-tested on their own; the service calls them after loading the booking.
 */

export interface BookingRef {
  branchId: string;
  staffMembershipId: string;
  status: string;
  startsAt: Date;
  endsAt: Date;
  holdExpiresAt: Date | null;
}

const DAY = 24 * 60 * 60_000;
/** Completed / no-show can be set (and corrected) until 7 days after the session (FSD 6.7). */
export const MARK_WINDOW_MS = 7 * DAY;

/** Owner: every booking. Manager: their branch. Staff: bookings assigned to them. */
export function canSeeBooking(scope: Scope, booking: BookingRef): boolean {
  if (scope.role === 'owner') return true;
  if (scope.role === 'manager') return booking.branchId === scope.branchId;
  return booking.staffMembershipId === scope.membershipId;
}

/** Reschedule, reassign, cancel: owner, or the manager of the booking's branch. */
export function canManageBooking(scope: Scope, booking: BookingRef): boolean {
  return (
    scope.role === 'owner' || (scope.role === 'manager' && booking.branchId === scope.branchId)
  );
}

/** Customer email and phone: not for staff (FSD 1.2: name and notes only). */
export const canSeeCustomerContact = (scope: Scope) => scope.role !== 'staff';

/** A hold that ran out counts as expired, even before the worker records it. */
export function effectiveStatus(booking: BookingRef, now: Date): string {
  if (
    booking.status === 'pending_payment' &&
    (!booking.holdExpiresAt || booking.holdExpiresAt <= now)
  ) {
    return 'expired';
  }
  return booking.status;
}

export interface ConsoleActions {
  reschedule: boolean;
  reassign: boolean;
  cancel: boolean;
  cancelNeedsReason: boolean;
  complete: boolean;
  noShow: boolean;
}

/** The buttons a Console user gets for a booking (FSD 6.5–6.7), the same rules the API applies. */
export function bookingActions(scope: Scope, booking: BookingRef, now: Date): ConsoleActions {
  const status = effectiveStatus(booking, now);
  const manage = canManageBooking(scope, booking);
  const upcoming = booking.startsAt > now;
  const live = status === 'confirmed' || status === 'pending_payment';
  const movable = manage && live && upcoming;

  const started = booking.startsAt <= now;
  const inWindow = now.getTime() <= booking.endsAt.getTime() + MARK_WINDOW_MS;
  const own = booking.staffMembershipId === scope.membershipId;
  // Marking: anyone who sees the booking (staff: their own) once it started; correcting a mark
  // (completed ↔ no-show) is for the owner and the branch manager only.
  const firstMark = status === 'confirmed' && started && inWindow && (manage || own);
  const correction = (status === 'completed' || status === 'no_show') && inWindow && manage;

  return {
    reschedule: movable,
    reassign: movable,
    cancel: manage && upcoming && live,
    cancelNeedsReason: status === 'confirmed',
    complete: firstMark || (correction && status === 'no_show'),
    noShow: firstMark || (correction && status === 'completed'),
  };
}
