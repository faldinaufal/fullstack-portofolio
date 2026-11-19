// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  asGuest,
  bookableBusiness,
  bookingBody,
  customerBookingBody,
  expectBooked,
  GUEST,
  nextWeekday,
  nyTime,
  portalBrowser,
  SECOND_OWNER,
  signUpCustomer,
  type BookableBusiness,
} from '../../test/booking-flows.js';
import { C, consoleFlows, PEOPLE } from '../../test/console-flows.js';
import { createHarness, type Harness } from '../../test/harness.js';

const PT = '/v1/portal';
const HOUR = 3_600_000;

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

interface Detail {
  startsAt: string;
  staffId: string;
  therapist: string;
  actions: { reschedule: boolean };
  rescheduling: { remaining: number; until: string } | null;
}

/** A paid (confirmed) guest booking, with its access token. */
async function confirmed(startsAt: string, email = GUEST.email) {
  const created = await expectBooked(
    portalBrowser(h),
    bookingBody(b, startsAt, { guest: { ...GUEST, email } }),
  );
  const url = new URL(created.checkoutUrl);
  const paid = await h.app.inject({
    method: 'POST',
    url: `/v1/payments/demo/${url.pathname.split('/').at(-1)}?tenant=${url.searchParams.get('tenant')}`,
    payload: { outcome: 'paid' },
  });
  expect(paid.statusCode).toBe(204);
  return created;
}

const move = (id: string, token: string, body: object) =>
  portalBrowser(h).request('POST', `${PT}/bookings/${id}/reschedule`, body, asGuest(token));

const slotsFor = async (id: string, token: string, staffId = b.staffId, date = monday) =>
  (
    await portalBrowser(h).get(
      `${PT}/bookings/${id}/reschedule-slots?date=${date}&staffId=${staffId}`,
      asGuest(token),
    )
  )
    .json<{ slots: { startsAt: string }[] }>()
    .slots.map((s) => s.startsAt);

describe('rescheduling a confirmed booking (FSD 6.5)', () => {
  it('moves it in place, counts it, emails the customer and audits it', async () => {
    const created = await confirmed(at('10:00'));
    const response = await move(created.booking.id, created.accessToken, {
      startsAt: at('14:00'),
    });
    expect(response.statusCode, response.body).toBe(200);
    expect(response.json<Detail>()).toMatchObject({
      startsAt: at('14:00'),
      actions: { reschedule: true },
      rescheduling: { remaining: 1 },
    });

    const row = await h.owner.booking.findUniqueOrThrow({
      where: { id: created.booking.id },
      include: { invoice: { include: { payments: true } } },
    });
    expect(row).toMatchObject({ status: 'confirmed', customerRescheduleCount: 1 });
    expect(row.endsAt.toISOString()).toBe(at('15:00'));
    expect(row.invoice?.payments).toHaveLength(1); // same invoice, same payment
    expect(await h.owner.auditLog.count({ where: { action: 'booking.rescheduled' } })).toBe(1);

    const email = await h.lastEmail(GUEST.email, 'portal.booking_rescheduled');
    expect(email?.when).toContain('14:00');
    expect(email?.previousWhen).toContain('10:00');

    // The old time is free again for others, the new one is taken.
    const other = await expectBooked(
      portalBrowser(h),
      bookingBody(b, at('10:00'), { guest: { ...GUEST, email: 'other@veloria.test' } }),
    );
    expect(other.booking.status).toBe('pending_payment');
  });

  it('can move next to its own current time: the booking does not block itself', async () => {
    const created = await confirmed(at('10:00'));
    const free = await slotsFor(created.booking.id, created.accessToken);
    expect(free).toContain(at('10:30')); // overlaps the current 10:00–11:15 only
    expect(free).not.toContain(at('10:00')); // the current time itself is not offered

    const response = await move(created.booking.id, created.accessToken, {
      startsAt: at('10:30'),
    });
    expect(response.statusCode, response.body).toBe(200);
  });

  it('can move to another therapist of the branch who performs the service', async () => {
    const flows = consoleFlows(h);
    const { membershipId: daniel } = await flows.addMember(
      b.owner,
      PEOPLE.daniel,
      'staff',
      b.branchId,
    );
    await b.owner.request('PUT', `${C}/members/${daniel}/working-hours`, {
      hours: [1, 2, 3, 4, 5].map((weekday) => ({ weekday, startsAt: '09:00', endsAt: '18:00' })),
    });
    const created = await confirmed(at('10:00'));

    // Daniel does not perform the service yet.
    const refused = await move(created.booking.id, created.accessToken, {
      startsAt: at('10:00'),
      staffId: daniel,
    });
    expect(refused.json()).toMatchObject({ code: 'SERVICE_NOT_OFFERED' });

    await b.owner.request('PUT', `${C}/members/${daniel}/services`, { serviceIds: [b.serviceId] });
    const moved = await move(created.booking.id, created.accessToken, {
      startsAt: at('10:00'),
      staffId: daniel,
    });
    expect(moved.json<Detail>()).toMatchObject({ staffId: daniel, therapist: 'Daniel K.' });
  });

  it('re-checks the rules and refuses a taken time', async () => {
    const first = await confirmed(at('10:00'));
    await confirmed(at('14:00'), 'second@veloria.test');
    const reason = async (startsAt: string) =>
      (await move(first.booking.id, first.accessToken, { startsAt })).json<{ code: string }>().code;
    expect(await reason(at('14:30'))).toBe('SLOT_TAKEN');
    expect(await reason(at('10:15'))).toBe('OFF_GRID');
    expect(await reason(at('17:30'))).toBe('OUTSIDE_OPENING_HOURS');
    expect(await reason(at('10:00'))).toBe('VALIDATION_FAILED'); // the same time
  });

  it('two bookings racing for the same new time: exactly one wins', async () => {
    const a = await confirmed(at('09:00'));
    const c = await confirmed(at('14:00'), 'second@veloria.test');
    const results = await Promise.all([
      move(a.booking.id, a.accessToken, { startsAt: at('16:00') }),
      move(c.booking.id, c.accessToken, { startsAt: at('16:00') }),
    ]);
    expect(results.map((r) => r.statusCode).sort()).toEqual([200, 409]);
  });

  it('two reschedules of the same booking at once cannot exceed the limit', async () => {
    const created = await confirmed(at('10:00'));
    await move(created.booking.id, created.accessToken, { startsAt: at('11:30') }); // 1 left
    const results = await Promise.all([
      move(created.booking.id, created.accessToken, { startsAt: at('13:00') }),
      move(created.booking.id, created.accessToken, { startsAt: at('15:00') }),
    ]);
    expect(results.map((r) => r.statusCode).sort()).toEqual([200, 409]);
    expect(
      (await h.owner.booking.findUniqueOrThrow({ where: { id: created.booking.id } }))
        .customerRescheduleCount,
    ).toBe(2);
  });

  it('stops after the allowed number of reschedules', async () => {
    const created = await confirmed(at('10:00'));
    await move(created.booking.id, created.accessToken, { startsAt: at('11:30') });
    const second = await move(created.booking.id, created.accessToken, { startsAt: at('13:00') });
    expect(second.json<Detail>()).toMatchObject({
      actions: { reschedule: false },
      rescheduling: { remaining: 0 },
    });
    const third = await move(created.booking.id, created.accessToken, { startsAt: at('15:00') });
    expect(third.json()).toMatchObject({ code: 'RESCHEDULE_LIMIT_REACHED' });
  });

  it('stops at the cut-off before the session', async () => {
    const created = await confirmed(at('10:00'));
    const detail = (
      await portalBrowser(h).get(
        `${PT}/bookings/${created.booking.id}`,
        asGuest(created.accessToken),
      )
    ).json<Detail>();
    expect(new Date(detail.rescheduling!.until).getTime()).toBe(
      new Date(at('10:00')).getTime() - 24 * HOUR,
    );

    h.clock.advance(new Date(detail.rescheduling!.until).getTime() - Date.now() + 60_000);
    const late = await move(created.booking.id, created.accessToken, { startsAt: at('14:00') });
    expect(late.json()).toMatchObject({ code: 'CUTOFF_PASSED' });
  });

  it('only confirmed bookings, and only the booking’s own viewers', async () => {
    const pending = await expectBooked(portalBrowser(h), bookingBody(b, at('10:00')));
    const response = await move(pending.booking.id, pending.accessToken, { startsAt: at('14:00') });
    expect(response.json()).toMatchObject({ code: 'NOT_RESCHEDULABLE' });

    const other = await confirmed(at('13:00'), 'other@veloria.test');
    const foreign = await move(other.booking.id, pending.accessToken, { startsAt: at('15:00') });
    expect(foreign.statusCode).toBe(404);
  });
});

describe('reminders (FSD 6.1, 6.5)', () => {
  it('payment queues a reminder for 24 h before the session; rescheduling queues a new one', async () => {
    const created = await confirmed(at('10:00'));
    const reminders = () =>
      h.owner.emailMessage.findMany({
        where: { template: 'portal.booking_reminder' },
        orderBy: { createdAt: 'asc' },
      });
    const [first] = await reminders();
    expect(first).toMatchObject({ status: 'queued', bookingId: created.booking.id });
    expect(first!.nextAttemptAt.getTime()).toBe(new Date(at('10:00')).getTime() - 24 * HOUR);
    expect(first!.bookingStartsAt?.toISOString()).toBe(at('10:00'));

    await move(created.booking.id, created.accessToken, { startsAt: at('14:00') });
    const after = await reminders();
    expect(after).toHaveLength(2); // the old one stays; the worker skips it (it no longer matches)
    expect(after[1]!.bookingStartsAt?.toISOString()).toBe(at('14:00'));
  });

  it('no reminder when the booking is made less than 24 h before the session', async () => {
    h.clock.advance(new Date(at('10:00')).getTime() - Date.now() - 20 * HOUR);
    await confirmed(at('10:00'));
    expect(
      await h.owner.emailMessage.count({ where: { template: 'portal.booking_reminder' } }),
    ).toBe(0);
    expect(
      await h.owner.emailMessage.count({ where: { template: 'portal.booking_confirmed' } }),
    ).toBe(1);
  });
});

describe('invoices (FSD 5.3, 6.10)', () => {
  it('a booking’s invoice opens with its access, and is billed to the customer', async () => {
    const created = await confirmed(at('10:00'));
    const invoice = await portalBrowser(h).get(
      `${PT}/bookings/${created.booking.id}/invoice`,
      asGuest(created.accessToken),
    );
    expect(invoice.json()).toMatchObject({
      number: created.booking.invoiceNumber,
      status: 'paid',
      amountCents: 4217,
      currency: 'usd',
      business: { name: 'Lumen Wellness Studio' },
      billedTo: { name: GUEST.name, email: GUEST.email },
      line: { description: 'Deep Tissue Massage', therapist: 'Ines H.', durationMinutes: 60 },
    });
    expect(
      (await portalBrowser(h).get(`${PT}/bookings/${created.booking.id}/invoice`)).statusCode,
    ).toBe(404);
  });

  it('My invoices lists the customer’s invoices at every business, newest first', async () => {
    const second = await bookableBusiness(h, SECOND_OWNER, PEOPLE.daniel);
    const shopper = await signUpCustomer(h);
    const lumen = await expectBooked(shopper, customerBookingBody(b, at('10:00')));
    h.clock.advance(60_000);
    const harbor = await expectBooked(
      shopper,
      customerBookingBody(second, nyTime(nextWeekday(2), '11:00')),
    );
    await expectBooked(portalBrowser(h), bookingBody(b, at('14:00'))); // someone else

    const list = (await shopper.get(`${PT}/invoices`)).json<{
      items: { bookingId: string; businessName: string; number: string }[];
      total: number;
    }>();
    expect(list.total).toBe(2);
    expect(list.items.map((i) => i.bookingId)).toEqual([harbor.booking.id, lumen.booking.id]);
    expect(list.items.map((i) => i.businessName)).toEqual([
      'Harbor Bodywork',
      'Lumen Wellness Studio',
    ]);
    expect((await portalBrowser(h).get(`${PT}/invoices`)).statusCode).toBe(401);
  });
});
