// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { describe, expect, it, vi } from 'vitest';
import { toInvoice, toReservation } from './data/http-reservation-repository';
import { createSessionAccessStore } from './data/session-access-store';
import {
  CONFIRMATION_WAIT_MS,
  formatCountdown,
  keepWaitingForPayment,
  rescheduleNotice,
  reserve,
  timeLeft,
  type ReservationRepository,
} from './domain/reservation';
import { toReservationView } from './presentation/use-reservation';

const dto = {
  id: 'fa1d0000-0000-4000-8000-000000004217',
  status: 'pending_payment' as const,
  business: { slug: 'lumen', name: 'Lumen Wellness Studio' },
  branchName: 'Downtown',
  serviceName: 'Deep Tissue Massage',
  therapist: 'Ines H.',
  therapistPhotoUrl: null,
  startsAt: '2026-11-23T15:00:00.000Z',
  endsAt: '2026-11-23T16:00:00.000Z',
  priceCents: 4217,
  timeZone: 'America/New_York',
  holdExpiresAt: '2026-11-20T10:32:00.000Z',
  invoiceNumber: 'LUM-2026-000001',
  branchAddress: '12 Harbor Street',
  notes: null,
  invoice: {
    number: 'LUM-2026-000001',
    status: 'open' as const,
    amountCents: 4217,
    issuedAt: '2026-11-20T10:00:00.000Z',
    paidAt: null,
  },
  payBy: '2026-11-20T10:30:00.000Z',
  actions: { pay: true, cancel: true, reschedule: false },
  rescheduling: null,
  branchId: 'fa1d0000-0000-4000-8000-000000000011',
  serviceId: 'fa1d0000-0000-4000-8000-000000000012',
  staffId: 'fa1d0000-0000-4000-8000-000000000013',
};

describe('booking and keeping the access token (FSD 3.1, 5.3)', () => {
  it('saves the token for this tab before going to Checkout', async () => {
    const repository = {
      create: vi.fn().mockResolvedValue({
        reservation: { id: dto.id },
        checkoutUrl: 'http://localhost:3000/demo-checkout/demo_cs_1',
        accessToken: 'secret-token-4217',
      }),
    } as unknown as ReservationRepository;
    const saved: Record<string, string> = {};
    const access = { get: () => null, save: (id: string, token: string) => (saved[id] = token) };

    const created = await reserve(repository, access, {} as never, 'key-1');
    expect(created.checkoutUrl).toContain('/demo-checkout/');
    expect(saved).toEqual({ [dto.id]: 'secret-token-4217' });
  });

  it('works when the browser refuses storage', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    } as unknown as Storage;
    const store = createSessionAccessStore(() => broken);
    expect(() => store.save(dto.id, 'token')).not.toThrow();
    expect(store.get(dto.id)).toBeNull();
    expect(createSessionAccessStore(() => undefined).get(dto.id)).toBeNull();
  });
});

describe('payment countdown', () => {
  const now = new Date('2026-11-20T10:00:00Z');

  it('counts down to the payment deadline and stops at zero', () => {
    expect(formatCountdown(timeLeft(new Date('2026-11-20T10:29:05Z'), now))).toBe('29:05');
    expect(formatCountdown(timeLeft(new Date('2026-11-20T09:59:00Z'), now))).toBe('0:00');
    expect(timeLeft(null, now)).toBe(0);
  });
});

describe('waiting for the payment webhook (FSD 6.4)', () => {
  const since = new Date('2026-11-20T10:00:00Z');
  const after = (ms: number) => new Date(since.getTime() + ms);

  it('keeps asking while pending, stops once decided or after the wait', () => {
    expect(keepWaitingForPayment(undefined, since, after(0))).toBe(true);
    expect(keepWaitingForPayment('pending_payment', since, after(10_000))).toBe(true);
    expect(keepWaitingForPayment('confirmed', since, after(10_000))).toBe(false);
    expect(keepWaitingForPayment('expired', since, after(10_000))).toBe(false);
    expect(keepWaitingForPayment('pending_payment', since, after(CONFIRMATION_WAIT_MS))).toBe(
      false,
    );
  });
});

describe('showing a booking', () => {
  it('maps the API response and shows times in the business time zone', () => {
    const reservation = toReservation(dto);
    expect(reservation.payBy).toEqual(new Date(dto.payBy));
    expect(reservation.invoice.paidAt).toBeNull();

    const view = toReservationView(reservation);
    // 15:00 UTC is 10:00 in New York (standard time), whatever the visitor's zone.
    expect(view.when).toBe('Mon, 23 Nov 2026 · 10:00–11:00');
    expect(view.price).toBe('$42.17');
    expect(view).toMatchObject({ statusLabel: 'Payment pending', statusTone: 'warning' });
  });
});

describe('rescheduling notice (FSD 6.5)', () => {
  const until = new Date('2026-11-22T15:00:00Z');

  it('says how many changes are left, or why moving is not offered', () => {
    expect(
      rescheduleNotice({ rescheduling: { remaining: 2, until }, actions: allowed(true) }),
    ).toEqual({ allowed: true, message: '2 changes left' });
    expect(
      rescheduleNotice({ rescheduling: { remaining: 1, until }, actions: allowed(true) })?.message,
    ).toBe('1 change left');
    expect(
      rescheduleNotice({ rescheduling: { remaining: 0, until }, actions: allowed(false) })?.message,
    ).toContain('as often as allowed');
    expect(
      rescheduleNotice({ rescheduling: { remaining: 2, until }, actions: allowed(false) })?.message,
    ).toContain('too close to the session');
    expect(rescheduleNotice({ rescheduling: null, actions: allowed(false) })).toBeNull();
  });
});

describe('invoice', () => {
  it('maps dates and keeps the line', () => {
    const invoice = toInvoice({
      bookingId: dto.id,
      number: 'LUM-2026-000001',
      status: 'void',
      currency: 'usd',
      amountCents: 4217,
      issuedAt: '2026-11-20T10:00:00.000Z',
      paidAt: null,
      voidedAt: '2026-11-20T10:32:00.000Z',
      voidReason: 'Payment hold expired',
      business: { name: 'Lumen Wellness Studio', slug: 'lumen' },
      branch: { name: 'Downtown', address: null },
      billedTo: { name: 'Omar Haddad', email: 'omar@veloria.test' },
      line: {
        description: 'Deep Tissue Massage',
        therapist: 'Ines H.',
        startsAt: '2026-11-23T15:00:00.000Z',
        durationMinutes: 60,
      },
      timeZone: 'America/New_York',
    });
    expect(invoice.reservationId).toBe(dto.id);
    expect(invoice.paidAt).toBeNull();
    expect(invoice.voidedAt).toEqual(new Date('2026-11-20T10:32:00.000Z'));
    expect(invoice.line.startsAt).toEqual(new Date('2026-11-23T15:00:00.000Z'));
  });
});

function allowed(reschedule: boolean) {
  return { pay: false, cancel: false, reschedule };
}
