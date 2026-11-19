// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { randomUUID } from 'node:crypto';
import { withDbContext } from '@tempora/db';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  book,
  bookableBusiness,
  bookingBody,
  customerBookingBody,
  expectBooked,
  GUEST,
  nextWeekday,
  nyTime,
  portalBrowser,
  signUpCustomer,
  type BookableBusiness,
} from '../../test/booking-flows.js';
import { C } from '../../test/console-flows.js';
import { createHarness, type Harness } from '../../test/harness.js';
import { createTokenHasher } from '../../lib/tokens.js';
import { createBookingService } from './service.js';

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
const year = () => new Date().getFullYear();

async function slots(serviceId = b.serviceId) {
  const response = await portalBrowser(h).get(
    `/v1/public/tenants/${b.slug}/availability?branchId=${b.branchId}&serviceId=${serviceId}&staffId=${b.staffId}&date=${monday}`,
  );
  return response.json<{ slots: { startsAt: string }[] }>().slots.map((s) => s.startsAt);
}

/** Simulates the provider's webhook through the real HTTP endpoint (signature verified). */
async function deliver(rawBody: string, signature: string) {
  return h.app.inject({
    method: 'POST',
    url: '/v1/webhooks/stripe',
    headers: { 'content-type': 'application/json', 'stripe-signature': signature },
    payload: rawBody,
  });
}

async function payment(bookingId: string) {
  const invoice = await h.owner.invoice.findUniqueOrThrow({
    where: { bookingId },
    include: { payments: true },
  });
  return { invoice, payment: invoice.payments[0]! };
}

describe('creating a booking (FSD 6.3)', () => {
  it('holds the slot for 32 minutes, numbers the invoice and returns the Checkout URL', async () => {
    const created = await expectBooked(portalBrowser(h), bookingBody(b, at('10:00')));

    expect(created.booking).toMatchObject({
      status: 'pending_payment',
      serviceName: 'Deep Tissue Massage',
      therapist: 'Ines H.',
      priceCents: 4217,
      invoiceNumber: `LUM-${year()}-000001`,
    });
    const hold = new Date(created.booking.holdExpiresAt!).getTime() - Date.now();
    expect(hold).toBeGreaterThan(31 * 60_000);
    expect(hold).toBeLessThanOrEqual(32 * 60_000);
    expect(created.checkoutUrl).toMatch(/^http:\/\/localhost:3000\/demo-checkout\/demo_cs_/);

    // The held slot and the one whose buffer would overlap it are no longer offered.
    const free = await slots();
    expect(free).not.toContain(at('10:00'));
    expect(free).not.toContain(at('09:00')); // 09:00 + 60 + 15 runs into 10:00
    expect(free).toContain(at('11:30')); // 10:00 + 60 + 15 = 11:15; 11:30 is free

    const customer = await h.owner.tenantCustomer.findFirstOrThrow();
    expect(customer).toMatchObject({ email: GUEST.email, customerAccountId: null });
  });

  it('links the booking to a logged-in customer with a verified email', async () => {
    const shopper = await signUpCustomer(h);
    const withoutGuest = customerBookingBody(b, at('10:00'));
    await expectBooked(shopper, withoutGuest);
    const customer = await h.owner.tenantCustomer.findFirstOrThrow({
      include: { customerAccount: true },
    });
    expect(customer.customerAccount?.email).toBe('ines.customer@veloria.test');
  });

  it('asks a visitor who is not logged in for guest details', async () => {
    const withoutGuest = customerBookingBody(b, at('10:00'));
    const response = await book(portalBrowser(h), withoutGuest);
    expect(response.json()).toMatchObject({ code: 'GUEST_DETAILS_REQUIRED' });
  });

  it('re-checks every rule and answers with the specific reason (FSD 6.13)', async () => {
    const owner = b.owner;
    await owner.post(`${C}/members/${b.staffId}/time-off`, {
      startsAt: at('15:00'),
      endsAt: at('16:00'),
    });
    await expectBooked(portalBrowser(h), bookingBody(b, at('10:00')));

    const reason = async (startsAt: string) =>
      (await book(portalBrowser(h), bookingBody(b, startsAt))).json<{ code: string }>().code;
    expect(await reason(at('10:15'))).toBe('OFF_GRID');
    expect(await reason(at('17:30'))).toBe('OUTSIDE_OPENING_HOURS'); // ends 18:30
    expect(await reason(at('14:30'))).toBe('THERAPIST_TIME_OFF'); // blocked until 15:45
    expect(await reason(at('10:30'))).toBe('SLOT_TAKEN');
    expect(await reason(nyTime(nextWeekday(6), '10:00'))).toBe('OUTSIDE_OPENING_HOURS'); // Saturday
    const soon = new Date(Date.now() + 60 * 60_000);
    soon.setUTCMinutes(soon.getUTCMinutes() < 30 ? 30 : 60, 0, 0);
    expect(['TOO_SOON', 'OUTSIDE_OPENING_HOURS', 'BRANCH_CLOSED']).toContain(
      await reason(soon.toISOString()),
    );
  });
});

describe('idempotency (FSD 5.1, 9.2)', () => {
  it('returns the same booking for the same key, and refuses the key with another body', async () => {
    const key = randomUUID();
    const first = await book(portalBrowser(h), bookingBody(b, at('10:00')), key);
    const again = await book(portalBrowser(h), bookingBody(b, at('10:00')), key);
    expect(again.statusCode).toBe(201);
    const { accessToken: firstToken, ...original } = first.json<{ accessToken: string }>();
    const { accessToken: retryToken, ...retried } = again.json<{ accessToken: string }>();
    expect(retried).toEqual(original);
    // The token is not kept with the stored response: the retry gets a new, working one.
    expect(retryToken).not.toBe(firstToken);
    const stored = await h.owner.idempotencyKey.findFirstOrThrow();
    expect(JSON.stringify(stored.responseBody)).not.toContain(firstToken);
    expect(stored.responseBody).not.toHaveProperty('accessToken');
    expect(await h.owner.booking.count()).toBe(1);

    const reused = await book(portalBrowser(h), bookingBody(b, at('11:30')), key);
    expect(reused.json()).toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSED' });
  });
});

describe('double booking under concurrency (FSD 9.2)', () => {
  it('20 parallel requests for the same slot: exactly one succeeds', async () => {
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        book(
          portalBrowser(h),
          bookingBody(b, at('10:00'), { guest: { ...GUEST, email: `guest${i}@veloria.test` } }),
        ),
      ),
    );
    const statuses = results.map((r) => r.statusCode).sort();
    expect(statuses.filter((s) => s === 201)).toHaveLength(1);
    expect(
      results.filter((r) => r.statusCode === 409).map((r) => r.json<{ code: string }>().code),
    ).toEqual(Array(19).fill('SLOT_TAKEN'));
    expect(await h.owner.booking.count({ where: { status: 'pending_payment' } })).toBe(1);
  });

  it('overlapping (not identical) slots are refused too', async () => {
    const [first, second] = await Promise.all([
      book(portalBrowser(h), bookingBody(b, at('10:00'))),
      book(
        portalBrowser(h),
        bookingBody(b, at('10:30'), { guest: { ...GUEST, email: 'other@veloria.test' } }),
      ),
    ]);
    expect([first.statusCode, second.statusCode].sort()).toEqual([201, 409]);
  });

  it('the exclusion constraint alone rejects overlaps; expired bookings do not block', async () => {
    const created = await expectBooked(portalBrowser(h), bookingBody(b, at('10:00')));
    const original = await h.owner.booking.findUniqueOrThrow({ where: { id: created.booking.id } });
    const copy = await h.owner.booking.findUniqueOrThrow({
      where: { id: created.booking.id },
      omit: { id: true, createdAt: true, updatedAt: true },
    });

    // Direct inserts, bypassing every API check.
    const overlapping = h.owner.booking.create({
      data: {
        ...copy,
        startsAt: new Date(original.startsAt.getTime() + 30 * 60_000),
        endsAt: new Date(original.endsAt.getTime() + 30 * 60_000),
        blockedUntil: new Date(original.blockedUntil.getTime() + 30 * 60_000),
      },
    });
    await expect(overlapping).rejects.toThrow();
    await expect(
      h.owner.booking.create({ data: { ...copy, status: 'expired' } }),
    ).resolves.toBeDefined();
  });
});

describe('invoice numbering (FSD 6.10, 9.2)', () => {
  it('50 parallel bookings get 50 unique, consecutive numbers', async () => {
    const days = [1, 2, 3, 4, 5].map((weekday) => nextWeekday(weekday));
    const starts = days.flatMap((date) =>
      Array.from({ length: 10 }, (_, i) =>
        nyTime(date, `${String(9 + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`),
      ),
    );
    const results = await Promise.all(
      starts.map((startsAt, i) =>
        book(
          portalBrowser(h),
          bookingBody(b, startsAt, {
            serviceId: b.quickServiceId,
            guest: { ...GUEST, email: `n${i}@veloria.test` },
          }),
        ),
      ),
    );
    expect(results.every((r) => r.statusCode === 201)).toBe(true);
    const numbers = results
      .map((r) => r.json<{ booking: { invoiceNumber: string } }>().booking.invoiceNumber)
      .sort();
    expect(numbers).toEqual(
      Array.from({ length: 50 }, (_, i) => `LUM-${year()}-${String(i + 1).padStart(6, '0')}`),
    );
  });
});

describe('payment (FSD 6.4)', () => {
  it('a paid Checkout confirms the booking once, however often the event arrives', async () => {
    const created = await expectBooked(portalBrowser(h), bookingBody(b, at('10:00')));
    const { invoice, payment: pay } = await payment(created.booking.id);
    const event = h.payments.signedEvent('paid', pay.checkoutSessionId, {
      tenantId: invoice.tenantId,
      bookingId: created.booking.id,
      invoiceId: invoice.id,
    });

    expect((await deliver(event.rawBody, event.signature)).statusCode).toBe(200);
    expect((await deliver(event.rawBody, event.signature)).statusCode).toBe(200); // duplicate

    const after = await payment(created.booking.id);
    expect(after.invoice.status).toBe('paid');
    expect(after.payment.status).toBe('succeeded');
    expect(
      await h.owner.booking.findUniqueOrThrow({ where: { id: created.booking.id } }),
    ).toMatchObject({
      status: 'confirmed',
      holdExpiresAt: null,
    });
    expect(
      await h.owner.emailMessage.count({ where: { template: 'portal.booking_confirmed' } }),
    ).toBe(1);
  });

  it('rejects a webhook with an invalid signature', async () => {
    const created = await expectBooked(portalBrowser(h), bookingBody(b, at('10:00')));
    const { invoice, payment: pay } = await payment(created.booking.id);
    const event = h.payments.signedEvent('paid', pay.checkoutSessionId, {
      tenantId: invoice.tenantId,
      bookingId: created.booking.id,
      invoiceId: invoice.id,
    });
    const forged = await deliver(
      event.rawBody.replace('"paid":true', '"paid":true '),
      event.signature,
    );
    expect(forged.statusCode).toBe(400);
    expect((await deliver(event.rawBody, 't=1,v1=deadbeef')).statusCode).toBe(400);
  });

  it('the demo checkout page pays through the same signed-webhook path', async () => {
    const created = await expectBooked(portalBrowser(h), bookingBody(b, at('10:00')));
    const url = new URL(created.checkoutUrl);
    const sessionId = url.pathname.split('/').at(-1)!;
    const tenant = url.searchParams.get('tenant')!;

    const page = await h.app.inject({
      method: 'GET',
      url: `/v1/payments/demo/${sessionId}?tenant=${tenant}`,
    });
    expect(page.json()).toMatchObject({ amountCents: 4217, status: 'pending' });
    const pay = await h.app.inject({
      method: 'POST',
      url: `/v1/payments/demo/${sessionId}?tenant=${tenant}`,
      payload: { outcome: 'paid' },
    });
    expect(pay.statusCode).toBe(204);
    expect(
      (await h.owner.booking.findUniqueOrThrow({ where: { id: created.booking.id } })).status,
    ).toBe('confirmed');
  });

  it('an unpaid hold expires: the slot is free again and the invoice void', async () => {
    const created = await expectBooked(portalBrowser(h), bookingBody(b, at('10:00')));
    h.clock.advance(33 * 60_000);
    expect(await slots()).toContain(at('10:00')); // the availability ignores expired holds

    // Booking the slot again releases the stale hold first (FSD 6.3 step 3).
    await expectBooked(
      portalBrowser(h),
      bookingBody(b, at('10:00'), { guest: { ...GUEST, email: 'next@veloria.test' } }),
    );
    const old = await payment(created.booking.id);
    expect(
      (await h.owner.booking.findUniqueOrThrow({ where: { id: created.booking.id } })).status,
    ).toBe('expired');
    expect(old.invoice).toMatchObject({ status: 'void', voidReason: 'Payment hold expired' });
    expect(old.payment.status).toBe('expired');
  });

  it('a payment that arrives after the hold expired is flagged, not applied (safety net)', async () => {
    const created = await expectBooked(portalBrowser(h), bookingBody(b, at('10:00')));
    const { invoice, payment: pay } = await payment(created.booking.id);
    const metadata = {
      tenantId: invoice.tenantId,
      bookingId: created.booking.id,
      invoiceId: invoice.id,
    };
    const expired = h.payments.signedEvent('expired', pay.checkoutSessionId, metadata);
    await deliver(expired.rawBody, expired.signature);

    const late = h.payments.signedEvent('paid', pay.checkoutSessionId, metadata);
    await deliver(late.rawBody, late.signature);

    expect(
      (await h.owner.booking.findUniqueOrThrow({ where: { id: created.booking.id } })).status,
    ).toBe('expired');
    expect((await payment(created.booking.id)).payment.status).toBe('needs_attention');
    expect(
      await h.owner.emailMessage.count({ where: { template: 'console.payment_needs_attention' } }),
    ).toBe(1);
  });

  it('releases the slot at once when the payment provider is unavailable', async () => {
    const failing = createBookingService({
      prisma: h.prisma,
      payments: {
        name: 'demo',
        createCheckout: async () => {
          const { PaymentProviderUnavailableError } =
            await import('../../lib/payments/provider.js');
          throw new PaymentProviderUnavailableError();
        },
        parseWebhook: () => {
          throw new Error('unused');
        },
        expireCheckout: async () => {},
      },
      hashToken: createTokenHasher('test-secret-'.repeat(3)),
      timeZone: 'America/New_York',
      portalUrl: 'http://localhost:3000',
    });
    await expect(
      failing.create(bookingBody(b, at('10:00')), null, randomUUID(), '127.0.0.1'),
    ).rejects.toMatchObject({
      code: 'PAYMENT_PROVIDER_UNAVAILABLE',
    });
    expect(await h.owner.booking.findFirstOrThrow()).toMatchObject({ status: 'expired' });
    expect(await slots()).toContain(at('10:00'));
  });
});

describe('row-level security for customers (FSD 4.4)', () => {
  it('a customer context sees only that customer’s bookings, across businesses', async () => {
    const shopper = await signUpCustomer(h);
    const asCustomer = customerBookingBody(b, at('10:00'));
    await expectBooked(shopper, asCustomer);
    await expectBooked(portalBrowser(h), bookingBody(b, at('13:00'))); // someone else, as guest

    const account = await h.owner.customerAccount.findFirstOrThrow();
    const visible = await withDbContext(h.prisma, { customerAccountId: account.id }, (tx) =>
      tx.booking.findMany(),
    );
    expect(visible).toHaveLength(1);
    expect(await withDbContext(h.prisma, {}, (tx) => tx.booking.findMany())).toEqual([]);
  });
});
