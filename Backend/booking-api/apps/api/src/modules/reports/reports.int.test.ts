// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  bookableBusiness,
  bookingBody,
  expectBooked,
  GUEST,
  nextWeekday,
  nyTime,
  paidBooking,
  portalBrowser,
  type BookableBusiness,
} from '../../test/booking-flows.js';
import { C, consoleFlows, MEMBER_PASSWORD, OWNER, PEOPLE } from '../../test/console-flows.js';
import { createHarness, type Harness, type TestBrowser } from '../../test/harness.js';
import { todayIn } from '../availability/engine.js';

let h: Harness;
let b: BookableBusiness;
let monday: string;

beforeAll(async () => {
  h = await createHarness();
});
afterAll(async () => {
  await h.close();
});
beforeEach(async () => {
  await h.reset();
  b = await bookableBusiness(h);
  monday = nextWeekday(1);
});

const at = (time: string) => nyTime(monday, time);
const NY = 'America/New_York';
const today = () => todayIn(NY, new Date(Date.now()));
const report = async <T>(browser: TestBrowser, path: string) => {
  const response = await browser.get(`${C}/reports/${path}`);
  expect(response.statusCode, response.body).toBe(200);
  return response.json<T>();
};

/**
 * Two paid sessions on Monday (10:00, 14:00), one paid then cancelled by the business
 * (refunded outside Tempora), and one unpaid hold.
 */
async function seed() {
  const first = await paidBooking(h, b, at('10:00'));
  const second = await paidBooking(h, b, at('14:00'), 'second@veloria.test');
  const refunded = await paidBooking(h, b, at('16:00'), 'refunded@veloria.test');
  await b.owner.post(`${C}/bookings/${refunded.booking.id}/cancel`, {
    reason: 'Branch closed early',
  });
  await expectBooked(
    portalBrowser(h),
    bookingBody(b, nyTime(nextWeekday(2), '10:00'), {
      serviceId: b.quickServiceId,
      guest: { ...GUEST, email: 'hold@veloria.test' },
    }),
  );
  return { first, second };
}

/** Moves the clock and logs the owner and Ines in again (sessions end after 12 idle hours). */
async function travel(instant: string) {
  h.clock.advance(new Date(instant).getTime() - Date.now());
  const flows = consoleFlows(h);
  return {
    owner: await flows.login(OWNER.email, OWNER.password),
    ines: await flows.login(PEOPLE.ines.email, MEMBER_PASSWORD),
  };
}

describe('revenue (FSD 6.14)', () => {
  it('paid invoices by the day they were paid, without refunded bookings; branch comparison', async () => {
    await seed();
    const flows = consoleFlows(h);
    const harbor = await flows.createBranch(b.owner, 'Harbor');

    const daily = await report<{
      buckets: { start: string; cents: number }[];
      totalCents: number;
      byBranch: { name: string; cents: number }[];
    }>(b.owner, 'revenue');
    expect(daily.totalCents).toBe(2 * 4217);
    expect(daily.buckets).toHaveLength(30);
    expect(daily.buckets.at(-1)).toEqual({ start: today(), cents: 2 * 4217 });
    expect(daily.byBranch).toEqual([
      { id: b.branchId, name: 'Downtown', cents: 2 * 4217 },
      { id: harbor.id, name: 'Harbor', cents: 0 },
    ]);

    const weekly = await report<{ buckets: { start: string }[] }>(b.owner, 'revenue?interval=week');
    expect(new Date(`${weekly.buckets[0]!.start}T12:00:00Z`).getUTCDay()).toBe(1); // Mondays

    const { browser: manager } = await flows.addMember(b.owner, PEOPLE.omar, 'manager', harbor.id);
    const forManager = await report<{ totalCents: number; byBranch: unknown[] }>(
      manager,
      'revenue',
    );
    expect(forManager).toMatchObject({ totalCents: 0, byBranch: [] });
    // A manager cannot ask for another branch: they always get their own.
    expect(
      (await report<{ totalCents: number }>(manager, `revenue?branchId=${b.branchId}`)).totalCents,
    ).toBe(0);
    expect((await b.staff.get(`${C}/reports/revenue`)).statusCode).toBe(403);
  });
});

describe('bookings per service (FSD 6.14)', () => {
  it('counts sessions that take place, with their revenue; holds and cancellations do not count', async () => {
    await seed();
    const range = `from=${monday}&to=${nextWeekday(2)}`;
    const services = await report<{
      items: { name: string; bookings: number; revenueCents: number }[];
    }>(b.owner, `bookings-by-service?${range}`);
    expect(services.items).toEqual([
      expect.objectContaining({ name: 'Deep Tissue Massage', bookings: 2, revenueCents: 2 * 4217 }),
    ]);
  });
});

describe('utilization (FSD 6.14)', () => {
  it('booked session minutes over working hours within opening hours, minus time off', async () => {
    await seed();
    await b.owner.post(`${C}/members/${b.staffId}/time-off`, {
      startsAt: at('12:00'),
      endsAt: at('13:00'),
    });
    const use = await report<{
      branches: { name: string; bookedMinutes: number; availableMinutes: number }[];
      therapists: { name: string; bookedMinutes: number; availableMinutes: number }[];
    }>(b.owner, `utilization?from=${monday}&to=${monday}`);
    // 09:00–18:00 = 540 minutes, minus one hour of time off; two 60-minute sessions.
    expect(use.therapists).toEqual([
      expect.objectContaining({
        name: 'Ines Halvorsen',
        bookedMinutes: 120,
        availableMinutes: 480,
      }),
    ]);
    expect(use.branches).toEqual([
      expect.objectContaining({ name: 'Downtown', bookedMinutes: 120, availableMinutes: 480 }),
    ]);
  });
});

describe('no-show rate and overview (FSD 6.14)', () => {
  it('no-shows over marked sessions; the overview adds today’s and pending figures', async () => {
    const { first, second } = await seed();
    const before = await report<{
      paymentsPending: number;
      activeTherapists: number;
      branches: number;
    }>(b.owner, 'overview');
    expect(before).toMatchObject({ paymentsPending: 1, activeTherapists: 1, branches: 1 });

    // Monday morning: both sessions are today.
    const morning = await travel(at('08:00'));
    expect((await report<{ bookingsToday: number }>(morning.owner, 'overview')).bookingsToday).toBe(
      2,
    );

    // Monday evening: Ines marks one completed, one no-show.
    const evening = await travel(at('19:00'));
    await evening.ines.post(`${C}/bookings/${first.booking.id}/complete`);
    await evening.ines.post(`${C}/bookings/${second.booking.id}/no-show`);
    const rate = await report<{ buckets: { start: string; finished: number; noShows: number }[] }>(
      evening.owner,
      `no-show-rate?from=${monday}&to=${monday}`,
    );
    expect(rate.buckets).toEqual([{ start: monday, finished: 2, noShows: 1 }]);
    expect((await report<{ noShowRate: number }>(evening.owner, 'overview')).noShowRate).toBe(0.5);
  });

  it('refuses a reversed or too long range', async () => {
    expect(
      (await b.owner.get(`${C}/reports/revenue?from=2026-11-10&to=2026-11-01`)).statusCode,
    ).toBe(400);
    expect(
      (await b.owner.get(`${C}/reports/utilization?from=2025-01-01&to=2026-11-01`)).statusCode,
    ).toBe(400);
  });
});
