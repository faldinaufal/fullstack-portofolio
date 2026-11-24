// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { withDbContext } from '@tempora/db';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  asGuest,
  bookableBusiness,
  bookingBody,
  CUSTOMER,
  customerBookingBody,
  expectBooked,
  GUEST,
  nextWeekday,
  nyTime,
  portalBrowser,
  SECOND_OWNER,
  signUpCustomer,
  verifyCustomer,
  type BookableBusiness,
} from '../../test/booking-flows.js';
import { PEOPLE } from '../../test/console-flows.js';
import { createHarness, type Harness, type TestBrowser } from '../../test/harness.js';

const PT = '/v1/portal';

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
  id: string;
  status: string;
  payBy: string | null;
  actions: { pay: boolean; cancel: boolean };
  invoice: { number: string; status: string };
}

const detail = async (browser: TestBrowser, id: string, token?: string) =>
  browser.get(`${PT}/bookings/${id}`, token ? asGuest(token) : {});

/** Pays through the demo checkout, i.e. the real signed-webhook path. */
async function pay(checkoutUrl: string) {
  const url = new URL(checkoutUrl);
  const sessionId = url.pathname.split('/').at(-1)!;
  const response = await h.app.inject({
    method: 'POST',
    url: `/v1/payments/demo/${sessionId}?tenant=${url.searchParams.get('tenant')}`,
    payload: { outcome: 'paid' },
  });
  expect(response.statusCode, response.body).toBe(204);
}

const freeSlots = async () =>
  (
    await portalBrowser(h).get(
      `/v1/public/tenants/${b.slug}/availability?branchId=${b.branchId}&serviceId=${b.serviceId}&staffId=${b.staffId}&date=${monday}`,
    )
  )
    .json<{ slots: { startsAt: string }[] }>()
    .slots.map((s) => s.startsAt);

describe('booking access without a login (FSD 5.3)', () => {
  it('the access token opens that booking, and only that booking', async () => {
    const mine = await expectBooked(portalBrowser(h), bookingBody(b, at('10:00')));
    const other = await expectBooked(
      portalBrowser(h),
      bookingBody(b, at('13:00'), { guest: { ...GUEST, email: 'other@veloria.test' } }),
    );

    const ok = await detail(portalBrowser(h), mine.booking.id, mine.accessToken);
    expect(ok.statusCode).toBe(200);
    expect(ok.json<Detail>()).toMatchObject({
      status: 'pending_payment',
      actions: { pay: true, cancel: true },
      invoice: { number: mine.booking.invoiceNumber, status: 'open' },
    });

    // No token, someone else's token, or a made-up one: the same 404.
    expect((await detail(portalBrowser(h), mine.booking.id)).statusCode).toBe(404);
    expect((await detail(portalBrowser(h), mine.booking.id, other.accessToken)).statusCode).toBe(
      404,
    );
    expect((await detail(portalBrowser(h), mine.booking.id, 'x'.repeat(43))).statusCode).toBe(404);
  });

  it('the token is stored only as a hash and is unreadable without it (RLS)', async () => {
    const created = await expectBooked(portalBrowser(h), bookingBody(b, at('10:00')));
    const rows = await h.owner.bookingAccessToken.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.tokenHash).not.toContain(created.accessToken);
    expect(await withDbContext(h.prisma, {}, (tx) => tx.bookingAccessToken.findMany())).toEqual([]);
  });

  it('a link stops working 7 days after the session', async () => {
    const created = await expectBooked(portalBrowser(h), bookingBody(b, at('10:00')));
    const linkEnds = new Date(at('11:00')).getTime() + 7 * 24 * 60 * 60_000;
    h.clock.advance(linkEnds - Date.now() - 60_000);
    const stillOpen = await detail(portalBrowser(h), created.booking.id, created.accessToken);
    expect(stillOpen.statusCode).toBe(200);
    h.clock.advance(2 * 60_000);
    expect(
      (await detail(portalBrowser(h), created.booking.id, created.accessToken)).statusCode,
    ).toBe(404);
  });
});

describe('paying later and confirmation (FSD 3.1, 6.4)', () => {
  it('resumes the open Checkout, then shows the paid booking with nothing left to do', async () => {
    const created = await expectBooked(portalBrowser(h), bookingBody(b, at('10:00')));
    const before = (
      await detail(portalBrowser(h), created.booking.id, created.accessToken)
    ).json<Detail>();
    const payBy = new Date(before.payBy!).getTime() - Date.now();
    expect(payBy).toBeGreaterThan(29 * 60_000);
    expect(payBy).toBeLessThanOrEqual(30 * 60_000); // the Checkout expiry, before the hold

    const resume = await portalBrowser(h).request(
      'POST',
      `${PT}/bookings/${created.booking.id}/checkout`,
      undefined,
      asGuest(created.accessToken),
    );
    expect(resume.json()).toEqual({ checkoutUrl: created.checkoutUrl });

    await pay(created.checkoutUrl);
    const after = (
      await detail(portalBrowser(h), created.booking.id, created.accessToken)
    ).json<Detail>();
    expect(after).toMatchObject({
      status: 'confirmed',
      payBy: null,
      actions: { pay: false, cancel: false },
      invoice: { status: 'paid' },
    });
    const again = await portalBrowser(h).request(
      'POST',
      `${PT}/bookings/${created.booking.id}/checkout`,
      undefined,
      asGuest(created.accessToken),
    );
    expect(again.json()).toMatchObject({ code: 'HOLD_EXPIRED' });
  });

  it('a hold that ran out shows as expired before the worker records it', async () => {
    const created = await expectBooked(portalBrowser(h), bookingBody(b, at('10:00')));
    h.clock.advance(33 * 60_000);
    const view = (
      await detail(portalBrowser(h), created.booking.id, created.accessToken)
    ).json<Detail>();
    expect(view).toMatchObject({ status: 'expired', actions: { pay: false, cancel: false } });
  });

  it('the guest confirmation email links to /manage/<token>, which opens the booking', async () => {
    const created = await expectBooked(portalBrowser(h), bookingBody(b, at('10:00')));
    await pay(created.checkoutUrl);
    const email = await h.lastEmail(GUEST.email, 'portal.booking_confirmed');
    const match = /\/manage\/([A-Za-z0-9_-]+)$/.exec(email!.bookingUrl);
    expect(match).not.toBeNull();

    const page = await portalBrowser(h).get(`${PT}/guest/booking`, asGuest(match![1]!));
    expect(page.json<Detail>()).toMatchObject({ id: created.booking.id, status: 'confirmed' });
    expect((await portalBrowser(h).get(`${PT}/guest/booking`)).statusCode).toBe(404);
  });

  it('a verified customer’s confirmation email links to My bookings', async () => {
    const shopper = await signUpCustomer(h);
    const created = await expectBooked(shopper, customerBookingBody(b, at('10:00')));
    await pay(created.checkoutUrl);
    const email = await h.lastEmail(CUSTOMER.email, 'portal.booking_confirmed');
    expect(email!.bookingUrl).toBe(`http://localhost:3000/account/bookings/${created.booking.id}`);
  });
});

describe('cancelling an unpaid booking (FSD 6.7)', () => {
  it('frees the slot at once, voids the invoice and audits it; only once', async () => {
    const created = await expectBooked(portalBrowser(h), bookingBody(b, at('10:00')));
    expect(await freeSlots()).not.toContain(at('10:00'));

    const cancel = () =>
      portalBrowser(h).request(
        'POST',
        `${PT}/bookings/${created.booking.id}/cancel`,
        undefined,
        asGuest(created.accessToken),
      );
    const done = await cancel();
    expect(done.statusCode, done.body).toBe(200);
    expect(done.json<Detail>()).toMatchObject({
      status: 'cancelled',
      actions: { pay: false, cancel: false },
      invoice: { status: 'void' },
    });
    expect(await freeSlots()).toContain(at('10:00'));
    expect(
      await h.owner.booking.findUniqueOrThrow({ where: { id: created.booking.id } }),
    ).toMatchObject({
      cancelledByType: 'guest',
      cancelledById: null,
    });
    expect(await h.owner.payment.findFirstOrThrow()).toMatchObject({ status: 'expired' });
    expect(await h.owner.auditLog.count({ where: { action: 'booking.cancelled' } })).toBe(1);

    expect((await cancel()).json()).toMatchObject({ code: 'NOT_CANCELLABLE' });
  });

  it('a paid booking cannot be cancelled online; a payment after cancelling is flagged', async () => {
    const paid = await expectBooked(portalBrowser(h), bookingBody(b, at('10:00')));
    await pay(paid.checkoutUrl);
    const refused = await portalBrowser(h).request(
      'POST',
      `${PT}/bookings/${paid.booking.id}/cancel`,
      undefined,
      asGuest(paid.accessToken),
    );
    expect(refused.json()).toMatchObject({ code: 'NOT_CANCELLABLE' });

    const late = await expectBooked(
      portalBrowser(h),
      bookingBody(b, at('13:00'), { guest: { ...GUEST, email: 'late@veloria.test' } }),
    );
    await portalBrowser(h).request(
      'POST',
      `${PT}/bookings/${late.booking.id}/cancel`,
      undefined,
      asGuest(late.accessToken),
    );
    await pay(late.checkoutUrl); // the demo session is still payable: safety net (FSD 6.4)
    expect(
      (await h.owner.booking.findUniqueOrThrow({ where: { id: late.booking.id } })).status,
    ).toBe('cancelled');
    expect(await h.owner.payment.count({ where: { status: 'needs_attention' } })).toBe(1);
  });

  it('a customer cancels their own booking with their session', async () => {
    const shopper = await signUpCustomer(h);
    const created = await expectBooked(shopper, customerBookingBody(b, at('10:00')));
    const done = await shopper.post(`${PT}/bookings/${created.booking.id}/cancel`);
    expect(done.json<Detail>().status).toBe('cancelled');
    const account = await h.owner.customerAccount.findFirstOrThrow();
    expect(await h.owner.booking.findFirstOrThrow()).toMatchObject({
      cancelledByType: 'customer',
      cancelledById: account.id,
    });
  });
});

describe('My bookings (FSD 2.1, 5.3)', () => {
  it('lists upcoming and past bookings across businesses, and only the customer’s own', async () => {
    const second = await bookableBusiness(h, SECOND_OWNER, PEOPLE.daniel);
    const shopper = await signUpCustomer(h);
    const lumen = await expectBooked(shopper, customerBookingBody(b, at('10:00')));
    const harbor = await expectBooked(
      shopper,
      customerBookingBody(second, nyTime(nextWeekday(2), '11:00')),
    );
    const cancelled = await expectBooked(shopper, customerBookingBody(b, at('14:00')));
    await shopper.post(`${PT}/bookings/${cancelled.booking.id}/cancel`);
    await expectBooked(portalBrowser(h), bookingBody(b, at('16:00'))); // a guest, not hers

    await pay(lumen.checkoutUrl);

    const upcoming = (await shopper.get(`${PT}/bookings?when=upcoming`)).json<{
      items: { id: string; business: { slug: string }; actions: object }[];
      total: number;
      counts: { upcoming: number; past: number };
    }>();
    expect(upcoming.items.map((i) => i.id)).toEqual([lumen.booking.id, harbor.booking.id]);
    expect(upcoming.items.map((i) => i.business.slug)).toEqual(['lumen', 'harbor']);
    expect(upcoming.total).toBe(2);
    expect(upcoming.counts).toEqual({ upcoming: 2, past: 1 });
    // The list carries the same actions as the detail: paid → reschedule, unpaid → pay/cancel.
    expect(upcoming.items.map((i) => i.actions)).toEqual([
      { pay: false, cancel: false, reschedule: true },
      { pay: true, cancel: true, reschedule: false },
    ]);

    const past = (await shopper.get(`${PT}/bookings?when=past`)).json<{
      items: { id: string }[];
    }>();
    expect(past.items.map((i) => i.id)).toEqual([cancelled.booking.id]);

    const page = (await shopper.get(`${PT}/bookings?pageSize=1&page=2`)).json<{
      items: { id: string }[];
      total: number;
    }>();
    expect(page).toMatchObject({ total: 2, items: [{ id: harbor.booking.id }] });

    // Detail through the session, without a token.
    expect((await detail(shopper, harbor.booking.id)).statusCode).toBe(200);
  });

  it('needs a login', async () => {
    expect((await portalBrowser(h).get(`${PT}/bookings`)).statusCode).toBe(401);
  });

  it('My invoices filters by status and text, and totals paid this year and open', async () => {
    const second = await bookableBusiness(h, SECOND_OWNER, PEOPLE.daniel);
    const shopper = await signUpCustomer(h);
    const paid = await expectBooked(shopper, customerBookingBody(b, at('10:00')));
    await pay(paid.checkoutUrl);
    const open = await expectBooked(
      shopper,
      customerBookingBody(second, nyTime(nextWeekday(2), '11:00')),
    );
    const voided = await expectBooked(shopper, customerBookingBody(b, at('14:00')));
    await shopper.post(`${PT}/bookings/${voided.booking.id}/cancel`);
    await expectBooked(portalBrowser(h), bookingBody(b, at('16:00'))); // someone else's

    type List = { items: { bookingId: string; paidAt: string | null }[]; total: number };
    const ids = async (query: string) =>
      (await shopper.get(`${PT}/invoices?${query}`)).json<List>().items.map((i) => i.bookingId);

    expect(await ids('status=paid')).toEqual([paid.booking.id]);
    expect(await ids('status=open')).toEqual([open.booking.id]);
    expect(await ids('status=void')).toEqual([voided.booking.id]);
    expect(await ids('q=harbor')).toEqual([open.booking.id]); // business name
    expect((await ids('q=deep tissue')).sort()).toEqual(
      [paid.booking.id, open.booking.id, voided.booking.id].sort(),
    ); // service name, any case
    const number = (await shopper.get(`${PT}/invoices?status=paid`)).json<{
      items: { number: string; paidAt: string | null }[];
    }>().items[0]!;
    expect(number.paidAt).not.toBeNull();
    expect(await ids(`q=${number.number.toLowerCase()}`)).toEqual([paid.booking.id]);
    expect((await shopper.get(`${PT}/invoices?status=refunded`)).statusCode).toBe(400);

    const totals = (await shopper.get(`${PT}/invoices/summary`)).json();
    expect(totals).toEqual({
      year: Number(
        new Intl.DateTimeFormat('en-US', { year: 'numeric', timeZone: 'America/New_York' }).format(
          new Date(),
        ),
      ),
      paid: { count: 1, amountCents: 4217 },
      open: { count: 1, amountCents: 4217 },
    });
    expect((await portalBrowser(h).get(`${PT}/invoices/summary`)).statusCode).toBe(401);
  });
});

describe('guest bookings and email verification (FSD 3.2)', () => {
  it('an unverified account is not linked; verifying links past guest bookings and revokes their links', async () => {
    const asGuestBefore = await expectBooked(
      portalBrowser(h),
      bookingBody(b, at('09:00'), { guest: { ...GUEST, email: CUSTOMER.email } }),
    );
    const shopper = await signUpCustomer(h, { verified: false });
    const unverified = await expectBooked(shopper, customerBookingBody(b, at('13:00')));

    expect((await shopper.get(`${PT}/bookings`)).json()).toMatchObject({ total: 0 });
    // The pages right after booking still work, through the access token.
    expect((await detail(shopper, unverified.booking.id, unverified.accessToken)).statusCode).toBe(
      200,
    );

    await verifyCustomer(h, shopper);
    const mine = (await shopper.get(`${PT}/bookings`)).json<{ items: { id: string }[] }>();
    expect(mine.items.map((i) => i.id)).toEqual([asGuestBefore.booking.id, unverified.booking.id]);
    expect(
      (await detail(portalBrowser(h), asGuestBefore.booking.id, asGuestBefore.accessToken))
        .statusCode,
    ).toBe(404);
  });

  it('signing up with someone else’s email reveals none of their bookings', async () => {
    const victim = await expectBooked(
      portalBrowser(h),
      bookingBody(b, at('09:00'), { guest: { ...GUEST, email: CUSTOMER.email } }),
    );
    const impostor = await signUpCustomer(h, { verified: false });
    await expectBooked(impostor, customerBookingBody(b, at('13:00')));

    expect((await impostor.get(`${PT}/bookings`)).json()).toMatchObject({ total: 0, items: [] });
    expect((await detail(impostor, victim.booking.id)).statusCode).toBe(404);
    expect(await h.owner.tenantCustomer.findFirstOrThrow()).toMatchObject({
      customerAccountId: null,
    });
  });
});
