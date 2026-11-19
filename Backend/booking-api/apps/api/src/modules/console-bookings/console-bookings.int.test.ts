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

const HOUR = 3_600_000;
const WEEKDAYS = [1, 2, 3, 4, 5];

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

/**
 * Moves the clock to a New York time on `monday`. Console sessions end after 12 idle hours
 * (FSD 6.11), so the people who act next log in again at the new time.
 */
async function travelTo(time: string) {
  h.clock.advance(new Date(at(time)).getTime() - Date.now());
  return relogin();
}
async function relogin() {
  const flows = consoleFlows(h);
  return {
    owner: await flows.login(OWNER.email, OWNER.password),
    ines: await flows.login(PEOPLE.ines.email, MEMBER_PASSWORD),
  };
}

interface Detail {
  status: string;
  startsAt: string;
  therapist: { id: string; name: string };
  customer: { name: string; email: string | null; phone: string | null };
  notes: string | null;
  refundHandledExternally: boolean;
  customerRescheduleCount: number;
  invoice: { status: string };
  actions: Record<string, boolean>;
  timeline: { action: string; actor: string }[];
}

/** Daniel, a second therapist at Downtown performing the same service. */
async function addDaniel() {
  const flows = consoleFlows(h);
  const { membershipId, browser } = await flows.addMember(
    b.owner,
    PEOPLE.daniel,
    'staff',
    b.branchId,
  );
  await b.owner.request('PUT', `${C}/members/${membershipId}/working-hours`, {
    hours: WEEKDAYS.map((weekday) => ({ weekday, startsAt: '09:00', endsAt: '18:00' })),
  });
  await b.owner.request('PUT', `${C}/members/${membershipId}/services`, {
    serviceIds: [b.serviceId],
  });
  return { id: membershipId, browser };
}

const detail = (browser: TestBrowser, id: string) => browser.get(`${C}/bookings/${id}`);
const act = (browser: TestBrowser, id: string, action: string, body?: object) =>
  browser.post(`${C}/bookings/${id}/${action}`, body ?? {});

describe('bookings table (FSD 2.2, 5.4)', () => {
  it('lists with filters; staff cannot open the table', async () => {
    const paid = await paidBooking(h, b, at('10:00'));
    await expectBooked(
      portalBrowser(h),
      bookingBody(b, at('14:00'), {
        guest: { ...GUEST, name: 'Lena Fischer', email: 'lena@veloria.test' },
      }),
    );
    const list = async (query = '') =>
      (await b.owner.get(`${C}/bookings${query}`)).json<{
        items: { id: string; customer: { name: string } }[];
        total: number;
      }>();

    expect((await list()).total).toBe(2);
    expect((await list('?status=confirmed')).items.map((i) => i.id)).toEqual([paid.booking.id]);
    expect((await list('?q=lena')).items.map((i) => i.customer.name)).toEqual(['Lena Fischer']);
    expect(
      (await list(`?from=${monday}&to=${monday}&sort=-startsAt`)).items[0]!.customer.name,
    ).toBe('Lena Fischer');
    expect((await list(`?from=${nextWeekday(2)}`)).total).toBe(0);
    expect((await b.staff.get(`${C}/bookings`)).statusCode).toBe(403);
  });

  it('a manager sees only their own branch, whatever the filter says', async () => {
    await paidBooking(h, b, at('10:00'));
    const flows = consoleFlows(h);
    const harbor = await flows.createBranch(b.owner, 'Harbor');
    const { browser: manager } = await flows.addMember(b.owner, PEOPLE.omar, 'manager', harbor.id);
    const total = async (query: string) =>
      (await manager.get(`${C}/bookings${query}`)).json<{ total: number }>().total;
    expect(await total('')).toBe(0);
    expect(await total(`?branchId=${b.branchId}`)).toBe(0);
  });
});

describe('booking detail (FSD 1.2, 3.8)', () => {
  it('the owner sees contact details and the timeline; staff see name and notes only', async () => {
    const created = await paidBooking(h, b, at('10:00'));
    const forOwner = (await detail(b.owner, created.booking.id)).json<Detail>();
    expect(forOwner.customer).toMatchObject({ email: GUEST.email, phone: GUEST.phone });
    expect(forOwner.timeline.map((t) => t.action)).toEqual([
      'booking.created',
      'booking.confirmed',
    ]);

    const forStaff = (await detail(b.staff, created.booking.id)).json<Detail>();
    expect(forStaff.customer).toMatchObject({ name: GUEST.name, email: null, phone: null });
    expect(forStaff.timeline).toEqual([]);

    const daniel = await addDaniel();
    expect((await detail(daniel.browser, created.booking.id)).statusCode).toBe(404);
  });
});

describe('the team moves bookings (FSD 6.5, 6.6)', () => {
  it('reschedules without counting it for the customer, and emails the customer', async () => {
    const created = await paidBooking(h, b, at('10:00'));
    const moved = await act(b.owner, created.booking.id, 'reschedule', { startsAt: at('15:00') });
    expect(moved.statusCode, moved.body).toBe(200);
    expect(moved.json<Detail>()).toMatchObject({
      startsAt: at('15:00'),
      customerRescheduleCount: 0,
    });
    const email = await h.lastEmail(GUEST.email, 'portal.booking_rescheduled');
    expect(email).toMatchObject({ therapist: 'Ines H.', previousTherapist: 'Ines H.' });
    expect(email?.when).toContain('15:00');
  });

  it('may move a booking inside the customers’ lead time, until it starts', async () => {
    const created = await paidBooking(h, b, at('16:00'));
    const { owner } = await travelTo('10:00');
    const moved = await act(owner, created.booking.id, 'reschedule', { startsAt: at('12:00') });
    expect(moved.statusCode, moved.body).toBe(200);
    h.clock.advance(3 * HOUR); // 13:00, after the new time
    const late = await act(owner, created.booking.id, 'reschedule', { startsAt: at('16:00') });
    expect(late.json()).toMatchObject({ code: 'NOT_RESCHEDULABLE' });
  });

  it('reassigns to another therapist at the same time; refuses a busy one', async () => {
    const daniel = await addDaniel();
    const created = await paidBooking(h, b, at('10:00'));
    const reassigned = await act(b.owner, created.booking.id, 'reassign', { staffId: daniel.id });
    expect(reassigned.json<Detail>()).toMatchObject({
      startsAt: at('10:00'),
      therapist: { id: daniel.id, name: 'Daniel Kim' },
    });
    expect(await h.lastEmail(GUEST.email, 'portal.booking_rescheduled')).toMatchObject({
      therapist: 'Daniel K.',
      previousTherapist: 'Ines H.',
    });

    const other = await paidBooking(h, b, at('10:00'), 'other@veloria.test'); // Ines is free now
    const busy = await act(b.owner, other.booking.id, 'reassign', { staffId: daniel.id });
    expect(busy.json()).toMatchObject({ code: 'SLOT_TAKEN' });
  });

  it('a manager of another branch, and staff, cannot move it', async () => {
    const created = await paidBooking(h, b, at('10:00'));
    const flows = consoleFlows(h);
    const harbor = await flows.createBranch(b.owner, 'Harbor');
    const { browser: manager } = await flows.addMember(b.owner, PEOPLE.omar, 'manager', harbor.id);
    expect(
      (await act(manager, created.booking.id, 'reschedule', { startsAt: at('15:00') })).statusCode,
    ).toBe(404);
    expect(
      (await act(b.staff, created.booking.id, 'reschedule', { startsAt: at('15:00') })).statusCode,
    ).toBe(403);
  });
});

describe('the team cancels (FSD 6.7)', () => {
  it('a paid booking needs a reason; the refund happens outside Tempora; the customer is told', async () => {
    const created = await paidBooking(h, b, at('10:00'));
    const noReason = await act(b.owner, created.booking.id, 'cancel');
    expect(noReason.json()).toMatchObject({ code: 'VALIDATION_FAILED' });

    const cancelled = await act(b.owner, created.booking.id, 'cancel', {
      reason: 'Therapist is ill',
    });
    expect(cancelled.json<Detail>()).toMatchObject({
      status: 'cancelled',
      refundHandledExternally: true,
      invoice: { status: 'paid' },
    });
    expect(await h.lastEmail(GUEST.email, 'portal.booking_cancelled')).toMatchObject({
      reason: 'Therapist is ill',
      refundByBusiness: true,
    });
    // The slot is free again.
    await expectBooked(
      portalBrowser(h),
      bookingBody(b, at('10:00'), { guest: { ...GUEST, email: 'next@veloria.test' } }),
    );
  });

  it('an unpaid booking: void invoice, no reason needed; nothing once the session started', async () => {
    const held = await expectBooked(portalBrowser(h), bookingBody(b, at('10:00')));
    const cancelled = await act(b.owner, held.booking.id, 'cancel');
    expect(cancelled.json<Detail>()).toMatchObject({
      status: 'cancelled',
      refundHandledExternally: false,
      invoice: { status: 'void' },
    });

    const started = await paidBooking(h, b, at('14:00'), 'other@veloria.test');
    const { owner } = await travelTo('14:30');
    expect(
      (await act(owner, started.booking.id, 'cancel', { reason: 'Too late' })).json(),
    ).toMatchObject({
      code: 'NOT_CANCELLABLE',
    });
  });
});

describe('completed and no-show (FSD 6.7)', () => {
  it('the therapist marks their own session once it started; leads correct it within 7 days', async () => {
    await addDaniel();
    const created = await paidBooking(h, b, at('10:00'));
    expect((await act(b.staff, created.booking.id, 'complete')).json()).toMatchObject({
      code: 'NOT_MARKABLE',
    });

    const { owner, ines } = await travelTo('10:30');
    const danielNow = await consoleFlows(h).login(PEOPLE.daniel.email, MEMBER_PASSWORD);
    expect((await act(danielNow, created.booking.id, 'complete')).statusCode).toBe(404);
    const done = await act(ines, created.booking.id, 'complete');
    expect(done.json<Detail>().status).toBe('completed');
    expect((await act(ines, created.booking.id, 'no-show')).json()).toMatchObject({
      code: 'NOT_MARKABLE',
    });
    const corrected = await act(owner, created.booking.id, 'no-show');
    expect(corrected.json<Detail>().status).toBe('no_show');

    h.clock.advance(8 * 24 * HOUR);
    const { owner: later } = await relogin();
    expect((await act(later, created.booking.id, 'complete')).json()).toMatchObject({
      code: 'NOT_MARKABLE',
    });
  });
});

describe('calendar (FSD 2.2)', () => {
  it('one branch with its therapists, bookings and time off; staff see only their own', async () => {
    const daniel = await addDaniel();
    const mine = await paidBooking(h, b, at('10:00'));
    await b.owner.request('PUT', `${C}/members/${daniel.id}/services`, {
      serviceIds: [b.serviceId],
    });
    await b.owner.post(`${C}/members/${daniel.id}/time-off`, {
      startsAt: at('13:00'),
      endsAt: at('14:00'),
    });
    const range = `from=${monday}&to=${nextWeekday(1, 2)}`;

    const all = (await b.owner.get(`${C}/calendar?${range}`)).json<{
      therapists: { id: string }[];
      bookings: { id: string; customerName: string }[];
      timeOff: { staffId: string }[];
    }>();
    expect(all.therapists).toHaveLength(2);
    expect(all.bookings.map((x) => x.id)).toEqual([mine.booking.id]);
    expect(all.timeOff.map((t) => t.staffId)).toEqual([daniel.id]);

    const own = (await daniel.browser.get(`${C}/calendar?${range}`)).json<typeof all>();
    expect(own.therapists.map((t) => t.id)).toEqual([daniel.id]);
    expect(own.bookings).toEqual([]);

    const tooLong = await b.owner.get(`${C}/calendar?from=${monday}&to=${nextWeekday(1, 20)}`);
    expect(tooLong.statusCode).toBe(400);
  });
});

describe('active bookings block schedule changes (FSD 6.8)', () => {
  it('time off, working hours, opening hours, closures, deactivation and archiving', async () => {
    const created = await paidBooking(h, b, at('10:00'));
    const conflictIds = (response: { json: <T>() => T }) =>
      response.json<{ code: string; conflicts?: { id: string }[] }>();

    const timeOff = await b.owner.post(`${C}/members/${b.staffId}/time-off`, {
      startsAt: at('11:00'),
      endsAt: at('12:00'),
    });
    // The buffer (11:00–11:15) counts: the booking is in the way.
    expect(conflictIds(timeOff)).toMatchObject({
      code: 'HAS_ACTIVE_BOOKINGS',
      conflicts: [{ id: created.booking.id }],
    });

    const hours = await b.owner.request('PUT', `${C}/members/${b.staffId}/working-hours`, {
      hours: [2, 3, 4, 5].map((weekday) => ({ weekday, startsAt: '09:00', endsAt: '18:00' })),
    });
    expect(conflictIds(hours).code).toBe('HAS_ACTIVE_BOOKINGS');
    const later = await b.owner.request('PUT', `${C}/members/${b.staffId}/working-hours`, {
      hours: WEEKDAYS.map((weekday) => ({ weekday, startsAt: '10:30', endsAt: '18:00' })),
    });
    expect(conflictIds(later).code).toBe('HAS_ACTIVE_BOOKINGS');

    const opening = await b.owner.request('PUT', `${C}/branches/${b.branchId}/opening-hours`, {
      hours: WEEKDAYS.map((weekday) => ({ weekday, opensAt: '11:00', closesAt: '18:00' })),
    });
    expect(conflictIds(opening).code).toBe('HAS_ACTIVE_BOOKINGS');

    const closure = await b.owner.post(`${C}/branches/${b.branchId}/closures`, {
      startsOn: monday,
      endsOn: monday,
      reason: 'Staff training',
    });
    expect(conflictIds(closure).code).toBe('HAS_ACTIVE_BOOKINGS');

    expect(conflictIds(await b.owner.post(`${C}/members/${b.staffId}/deactivate`)).code).toBe(
      'HAS_ACTIVE_BOOKINGS',
    );
    expect(conflictIds(await b.owner.post(`${C}/services/${b.serviceId}/archive`)).code).toBe(
      'HAS_ACTIVE_BOOKINGS',
    );

    // Once the booking is out of the way, the same change goes through.
    await act(b.owner, created.booking.id, 'cancel', { reason: 'Branch training day' });
    const after = await b.owner.post(`${C}/branches/${b.branchId}/closures`, {
      startsOn: monday,
      endsOn: monday,
      reason: 'Staff training',
    });
    expect(after.statusCode, after.body).toBe(201);
  });

  it('time off next to a booking (after its buffer) is fine', async () => {
    await paidBooking(h, b, at('10:00'));
    const ok = await b.owner.post(`${C}/members/${b.staffId}/time-off`, {
      startsAt: at('11:15'),
      endsAt: at('12:00'),
    });
    expect(ok.statusCode, ok.body).toBe(201);
  });
});
