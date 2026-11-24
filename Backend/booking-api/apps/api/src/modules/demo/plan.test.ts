// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { describe, expect, it } from 'vitest';
import { calendarDateOf } from '../availability/engine.js';
import { wallMinutes } from '../bookings/active.js';
import { buildDemoPlan } from './plan.js';
import { DEMO_ACCOUNTS } from './world.js';

const TZ = 'America/New_York';
const now = new Date('2026-11-24T15:00:00Z');
const plan = buildDemoPlan({ now, timeZone: TZ, passwordHash: 'hash', portalUrl: 'http://p' });

const ACTIVE = new Set(['pending_payment', 'confirmed']);

describe('demo plan (FSD 10.3)', () => {
  it('is the same every time for the same moment', () => {
    const again = buildDemoPlan({ now, timeZone: TZ, passwordHash: 'hash', portalUrl: 'http://p' });
    expect(again).toEqual(plan);
  });

  it('two businesses, 90 days back and 14 ahead, with bookings at every branch', () => {
    expect(plan.tenants.map((t) => t.name)).toEqual([
      'Lumen Wellness Studio',
      'Harbor Physio Clinic',
    ]);
    const days = plan.bookings.map((b) => (b.startsAt as Date).getTime());
    expect(Math.min(...days)).toBeLessThan(now.getTime() - 85 * 86_400_000);
    expect(Math.max(...days)).toBeGreaterThan(now.getTime() + 10 * 86_400_000);
    for (const branch of plan.branches) {
      expect(plan.bookings.some((b) => b.branchId === branch.id)).toBe(true);
    }
    expect(plan.bookings.length).toBeGreaterThan(1000);
  });

  it('an active booking never overlaps another of its therapist (exclusion constraint)', () => {
    const byTherapist = new Map<string, { from: number; to: number }[]>();
    for (const b of plan.bookings.filter((x) => ACTIVE.has(x.status as string))) {
      const list = byTherapist.get(b.staffMembershipId) ?? [];
      list.push({ from: (b.startsAt as Date).getTime(), to: (b.blockedUntil as Date).getTime() });
      byTherapist.set(b.staffMembershipId, list);
    }
    for (const list of byTherapist.values()) {
      list.sort((a, b) => a.from - b.from);
      for (let i = 1; i < list.length; i += 1)
        expect(list[i]!.from).toBeGreaterThanOrEqual(list[i - 1]!.to);
    }
  });

  it('every booking starts on the 30-minute grid inside its therapist hours', () => {
    const hours = new Map(plan.workingHours.map((w) => [`${w.membershipId}/${w.weekday}`, w]));
    for (const b of plan.bookings) {
      const starts = b.startsAt as Date;
      const date = calendarDateOf(starts, TZ);
      const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
      const window = hours.get(`${b.staffMembershipId}/${weekday}`);
      expect(window, `${b.id} on a day off`).toBeDefined();
      const minute = wallMinutes(starts, TZ);
      const end = minute + (b.durationMinutes as number) + (b.bufferMinutes as number);
      expect(minute % 30).toBe(0);
      const buffer = (b.bufferMinutes as number) * 60_000;
      expect((b.blockedUntil as Date).getTime()).toBe((b.endsAt as Date).getTime() + buffer);
      const from =
        (window!.startsAt as Date).getUTCHours() * 60 + (window!.startsAt as Date).getUTCMinutes();
      const to =
        (window!.endsAt as Date).getUTCHours() * 60 + (window!.endsAt as Date).getUTCMinutes();
      expect(minute).toBeGreaterThanOrEqual(from);
      expect(end).toBeLessThanOrEqual(to);
    }
  });

  it('statuses carry the timestamps the database requires', () => {
    for (const b of plan.bookings) {
      const marked = b.status === 'completed' || b.status === 'no_show';
      expect(b.markedAt != null).toBe(marked);
      expect(b.cancelledAt != null).toBe(b.status === 'cancelled');
      if (b.refundHandledExternally) expect(b.status).toBe('cancelled');
      if (b.cancelledAt) {
        expect((b.cancelledAt as Date) < (b.startsAt as Date)).toBe(true);
        expect((b.cancelledAt as Date) > (b.createdAt as Date)).toBe(true);
      }
      expect((b.createdAt as Date) <= now).toBe(true);
      // Nothing in the future is already finished.
      if ((b.startsAt as Date) > now) expect(marked).toBe(false);
    }
    expect(plan.bookings.some((b) => b.status === 'pending_payment')).toBe(false);
  });

  it('one invoice per booking, numbered without gaps per business and year', () => {
    expect(plan.invoices).toHaveLength(plan.bookings.length);
    for (const tenant of plan.tenants) {
      const numbers = plan.invoices
        .filter((i) => i.tenantId === tenant.id)
        .map((i) => Number((i.number as string).split('-')[2]));
      expect(numbers).toEqual(numbers.map((_, i) => i + 1));
      const counter = plan.invoiceCounters.find((c) => c.tenantId === tenant.id)!;
      expect(counter.nextValue).toBe(numbers.length + 1);
    }
    const paid = new Set(plan.invoices.filter((i) => i.status === 'paid').map((i) => i.bookingId));
    for (const b of plan.bookings) {
      expect(paid.has(b.id!)).toBe(
        b.status !== 'expired' && (b.status !== 'cancelled' || b.refundHandledExternally === true),
      );
    }
  });

  it('the demo customer has upcoming and past visits at both businesses', () => {
    const account = plan.customerAccounts[0]!;
    expect(account.email).toBe(DEMO_ACCOUNTS.customer.email);
    const records = plan.tenantCustomers.filter((c) => c.customerAccountId === account.id);
    expect(records).toHaveLength(2);
    for (const record of records) {
      const mine = plan.bookings.filter((b) => b.tenantCustomerId === record.id);
      expect(
        mine.some((b) => (b.startsAt as Date).getTime() > now.getTime() + 2 * 86_400_000),
      ).toBe(true);
      expect(mine.some((b) => (b.startsAt as Date) < now)).toBe(true);
    }
  });

  it('a demo login for every role, all fictional', () => {
    const emails = [
      ...plan.teamAccounts.map((a) => a.email),
      ...plan.customerAccounts.map((a) => a.email),
      ...plan.platformAdmins.map((a) => a.email),
      ...plan.tenantCustomers.map((c) => c.email),
    ];
    expect(emails.every((e) => e.endsWith('@veloria.test'))).toBe(true);
    const roles = new Set(plan.memberships.map((m) => m.role));
    expect([...roles].sort()).toEqual(['manager', 'owner', 'staff']);
    expect(plan.platformAdmins.map((a) => a.email)).toEqual([DEMO_ACCOUNTS.admin.email]);
    const team = plan.teamAccounts.map((a) => a.email);
    expect(new Set(team).size).toBe(team.length);
    for (const tenant of plan.tenants) {
      const customers = plan.tenantCustomers
        .filter((c) => c.tenantId === tenant.id)
        .map((c) => c.email);
      expect(new Set(customers).size).toBe(customers.length);
    }
  });
});
