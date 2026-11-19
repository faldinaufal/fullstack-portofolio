// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { describe, expect, it } from 'vitest';
import type { Scope } from '../console-auth/access.js';
import {
  bookingActions,
  canManageBooking,
  canSeeBooking,
  canSeeCustomerContact,
  type BookingRef,
} from './access.js';

const HOUR = 3_600_000;
const now = new Date('2026-11-23T15:00:00Z');
const at = (hours: number) => new Date(now.getTime() + hours * HOUR);

const owner: Scope = { role: 'owner', branchId: null, membershipId: 'm-owner' };
const manager: Scope = { role: 'manager', branchId: 'downtown', membershipId: 'm-manager' };
const otherManager: Scope = { role: 'manager', branchId: 'harbor', membershipId: 'm-other' };
const ines: Scope = { role: 'staff', branchId: 'downtown', membershipId: 'm-ines' };
const daniel: Scope = { role: 'staff', branchId: 'downtown', membershipId: 'm-daniel' };

const booking = (overrides: Partial<BookingRef> = {}): BookingRef => ({
  branchId: 'downtown',
  staffMembershipId: 'm-ines',
  status: 'confirmed',
  startsAt: at(48),
  endsAt: at(49),
  holdExpiresAt: null,
  ...overrides,
});

describe('who sees and manages a booking (FSD 1.2)', () => {
  it('owner all, manager own branch, staff only their own', () => {
    expect(canSeeBooking(owner, booking())).toBe(true);
    expect(canSeeBooking(manager, booking())).toBe(true);
    expect(canSeeBooking(otherManager, booking())).toBe(false);
    expect(canSeeBooking(ines, booking())).toBe(true);
    expect(canSeeBooking(daniel, booking())).toBe(false);
  });

  it('only the owner and the branch manager manage; staff never see contact details', () => {
    expect(canManageBooking(owner, booking())).toBe(true);
    expect(canManageBooking(manager, booking())).toBe(true);
    expect(canManageBooking(otherManager, booking())).toBe(false);
    expect(canManageBooking(ines, booking())).toBe(false);
    expect(canSeeCustomerContact(ines)).toBe(false);
    expect(canSeeCustomerContact(manager)).toBe(true);
  });
});

describe('actions (FSD 6.5–6.7)', () => {
  it('an upcoming paid booking: move or cancel with a reason, not mark', () => {
    expect(bookingActions(manager, booking(), now)).toEqual({
      reschedule: true,
      reassign: true,
      cancel: true,
      cancelNeedsReason: true,
      complete: false,
      noShow: false,
    });
    expect(bookingActions(ines, booking(), now)).toMatchObject({
      reschedule: false,
      cancel: false,
    });
  });

  it('an unpaid booking: cancel without a reason; an expired hold: nothing', () => {
    const held = booking({ status: 'pending_payment', holdExpiresAt: at(0.5) });
    expect(bookingActions(owner, held, now)).toMatchObject({
      cancel: true,
      cancelNeedsReason: false,
    });
    const stale = booking({ status: 'pending_payment', holdExpiresAt: at(-0.1) });
    expect(bookingActions(owner, stale, now)).toMatchObject({
      cancel: false,
      reschedule: false,
    });
  });

  it('after it starts: the therapist and leads mark it, within 7 days', () => {
    const started = booking({ startsAt: at(-0.5), endsAt: at(0.5) });
    expect(bookingActions(ines, started, now)).toMatchObject({ complete: true, noShow: true });
    expect(bookingActions(daniel, started, now)).toMatchObject({ complete: false });
    expect(bookingActions(owner, started, now)).toMatchObject({
      complete: true,
      reschedule: false,
      cancel: false,
    });
    const old = booking({ startsAt: at(-8 * 24 - 1), endsAt: at(-8 * 24) });
    expect(bookingActions(owner, old, now)).toMatchObject({ complete: false, noShow: false });
  });

  it('a mark is corrected by the owner or the manager, not by staff', () => {
    const marked = booking({ status: 'no_show', startsAt: at(-3), endsAt: at(-2) });
    expect(bookingActions(manager, marked, now)).toMatchObject({ complete: true, noShow: false });
    expect(bookingActions(ines, marked, now)).toMatchObject({ complete: false, noShow: false });
  });
});
