// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { randomUUID } from 'node:crypto';
import { expect } from 'vitest';
import { todayIn, wallTimeToInstant } from '../modules/availability/engine.js';
import { C, consoleFlows, OWNER, PEOPLE } from './console-flows.js';
import { TestBrowser, type Harness } from './harness.js';

export const NY = 'America/New_York';

/** The next date (in New York) with the given weekday, at least 2 days ahead. */
export function nextWeekday(weekday: number, minDaysAhead = 2): string {
  const d = new Date(`${todayIn(NY, new Date())}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + minDaysAhead);
  while (d.getUTCDay() !== weekday) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** `HH:MM` on a New York calendar date as an ISO instant (handles daylight saving). */
export function nyTime(date: string, time: string): string {
  const [hour, minute] = time.split(':').map(Number);
  const instant = wallTimeToInstant(date, hour! * 60 + minute!, NY);
  if (!instant) throw new Error(`${date} ${time} does not exist in New York`);
  return instant.toISOString();
}

export interface BookableBusiness {
  owner: TestBrowser;
  slug: string;
  branchId: string;
  /** 60 min + 15 min buffer, $42.17. */
  serviceId: string;
  /** 30 min, no buffer: fits 18 sessions a day, for the numbering test. */
  quickServiceId: string;
  staffId: string;
  /** Ines, logged in to the Console as staff of the branch. */
  staff: TestBrowser;
}

/**
 * A business ready for bookings: Downtown open Mon–Fri 09:00–18:00, two services, and Ines
 * working Mon–Fri 09:00–18:00 performing both.
 */
/** A second business, for "My bookings across businesses". */
export const SECOND_OWNER = {
  name: 'Jonah Reed',
  email: 'jonah@veloria.test',
  password: 'correct horse battery',
  businessName: 'Harbor Bodywork',
  slug: 'harbor',
};

export async function bookableBusiness(
  h: Harness,
  input = OWNER,
  therapist = PEOPLE.ines,
): Promise<BookableBusiness> {
  const flows = consoleFlows(h);
  const owner = await flows.signUp(input);
  const branch = await flows.createBranch(owner, 'Downtown');
  const weekdays = [1, 2, 3, 4, 5];
  await owner.request('PUT', `${C}/branches/${branch.id}/opening-hours`, {
    hours: weekdays.map((weekday) => ({ weekday, opensAt: '09:00', closesAt: '18:00' })),
  });
  const create = async (body: object) =>
    (await owner.post(`${C}/services`, body)).json<{ id: string }>().id;
  const serviceId = await create({
    name: 'Deep Tissue Massage',
    durationMinutes: 60,
    bufferMinutes: 15,
    priceCents: 4217,
  });
  const quickServiceId = await create({
    name: 'Quick Consult',
    durationMinutes: 30,
    bufferMinutes: 0,
    priceCents: 2500,
  });
  const { membershipId, browser: staff } = await flows.addMember(
    owner,
    therapist,
    'staff',
    branch.id,
  );
  await owner.request('PUT', `${C}/members/${membershipId}/working-hours`, {
    hours: weekdays.map((weekday) => ({ weekday, startsAt: '09:00', endsAt: '18:00' })),
  });
  await owner.request('PUT', `${C}/members/${membershipId}/services`, {
    serviceIds: [serviceId, quickServiceId],
  });
  return {
    owner,
    slug: input.slug,
    branchId: branch.id,
    serviceId,
    quickServiceId,
    staffId: membershipId,
    staff,
  };
}

/** A guest booking paid through the demo checkout (confirmed), with its access token. */
export async function paidBooking(
  h: Harness,
  b: BookableBusiness,
  startsAt: string,
  email = GUEST.email,
) {
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
  expect(paid.statusCode, paid.body).toBe(204);
  return created;
}

export const GUEST = { name: 'Omar Haddad', email: 'omar@veloria.test', phone: '+15550147002' };

/** A Portal visitor (guest or logged-in customer). */
export const portalBrowser = (h: Harness) => new TestBrowser(h.app, '/v1/portal/auth/csrf');

/** A booking by a logged-in customer: no guest details. */
export function customerBookingBody(b: BookableBusiness, startsAt: string, extra: object = {}) {
  return {
    tenantSlug: b.slug,
    branchId: b.branchId,
    serviceId: b.serviceId,
    staffId: b.staffId,
    startsAt,
    ...extra,
  };
}

/** A guest booking (FSD 6.3): the same, plus contact details. */
export function bookingBody(b: BookableBusiness, startsAt: string, extra: object = {}) {
  return { ...customerBookingBody(b, startsAt), guest: GUEST, ...extra };
}

export async function book(browser: TestBrowser, body: object, key: string = randomUUID()) {
  return browser.request('POST', '/v1/portal/bookings', body, { 'idempotency-key': key });
}

export async function expectBooked(browser: TestBrowser, body: object) {
  const response = await book(browser, body);
  expect(response.statusCode, response.body).toBe(201);
  return response.json<{
    booking: { id: string; status: string; invoiceNumber: string; holdExpiresAt: string | null };
    checkoutUrl: string;
    accessToken: string;
  }>();
}

/** `Authorization: Guest <token>` (FSD 5.3). */
export const asGuest = (token: string) => ({ authorization: `Guest ${token}` });

export const CUSTOMER = {
  name: 'Ines Halvorsen',
  email: 'ines.customer@veloria.test',
  password: 'quiet river at dawn 4217',
};

/** Confirms a customer's email with the link from the verification email. */
export async function verifyCustomer(h: Harness, browser: TestBrowser, email = CUSTOMER.email) {
  const payload = await h.lastEmail(email, 'portal.verify_email');
  const token = new URL(payload!.verifyUrl).searchParams.get('token')!;
  const response = await browser.post('/v1/portal/auth/verify-email', { token });
  expect(response.statusCode, response.body).toBe(200);
}

/** A logged-in Portal customer, with a verified email unless asked otherwise. */
export async function signUpCustomer(
  h: Harness,
  { verified = true, email = CUSTOMER.email }: { verified?: boolean; email?: string } = {},
) {
  const browser = portalBrowser(h);
  const response = await browser.post('/v1/portal/auth/signup', { ...CUSTOMER, email });
  expect(response.statusCode, response.body).toBe(201);
  if (verified) await verifyCustomer(h, browser, email);
  return browser;
}
