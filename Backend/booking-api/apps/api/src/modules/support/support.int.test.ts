// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { withDbContext } from '@tempora/db';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { A, adminFlows } from '../../test/admin-flows.js';
import {
  bookableBusiness,
  nextWeekday,
  nyTime,
  paidBooking,
  SECOND_OWNER,
  type BookableBusiness,
} from '../../test/booking-flows.js';
import { C, OWNER } from '../../test/console-flows.js';
import { createHarness, type Harness, type TestBrowser } from '../../test/harness.js';
import { createConsoleBookingService } from '../console-bookings/service.js';
import { createConsoleRecordsService } from '../console-records/service.js';

const MINUTE = 60_000;

let h: Harness;
let b: BookableBusiness;
let flows: ReturnType<typeof adminFlows>;
let tenantId: string;
let bookingId: string;

beforeAll(async () => {
  h = await createHarness();
});
afterAll(async () => {
  await h.close();
});
beforeEach(async () => {
  await h.reset();
  b = await bookableBusiness(h);
  flows = adminFlows(h);
  await flows.create();
  tenantId = (await h.owner.tenant.findUniqueOrThrow({ where: { slug: OWNER.slug } })).id;
  bookingId = (await paidBooking(h, b, nyTime(nextWeekday(1), '10:00'))).booking.id;
});

const support = (path = '') => `${A}/tenants/${tenantId}/support${path}`;

async function grant(hours: number) {
  const response = await b.owner.post(`${C}/support-grants`, { durationHours: hours });
  expect(response.statusCode, response.body).toBe(201);
  return response.json<{
    active: { id: string; startsAt: string; expiresAt: string } | null;
    items: unknown[];
  }>();
}

const tenantLog = (action: string) =>
  h.owner.auditLog.findMany({ where: { tenantId, action }, orderBy: { createdAt: 'asc' } });

const code = (response: { json: <T>() => T }) => response.json<{ code: string }>().code;

describe('support grants in the Console (FSD 1.4, 5.4)', () => {
  it('the owner grants, replaces and revokes; each step is audited', async () => {
    const first = await grant(1);
    expect(first.active).not.toBeNull();

    // Granting again replaces the active grant: one active, the old one ends now.
    const second = await grant(24);
    expect(second.items).toHaveLength(2);
    expect(second.items).toMatchObject([
      { status: 'active', grantedBy: OWNER.name },
      { status: 'revoked' },
    ]);
    const expires =
      new Date(second.active!.expiresAt).getTime() - new Date(second.active!.startsAt).getTime();
    expect(Math.round(expires / MINUTE)).toBe(24 * 60);

    const revoked = await b.owner.request('DELETE', `${C}/support-grants/${second.active!.id}`);
    expect(revoked.statusCode, revoked.body).toBe(200);
    expect(revoked.json()).toMatchObject({ active: null });
    // Revoking an ended grant changes nothing (and logs nothing).
    await b.owner.request('DELETE', `${C}/support-grants/${second.active!.id}`);

    expect((await tenantLog('support.granted')).map((e) => e.after)).toEqual([
      expect.objectContaining({ durationHours: 1 }),
      expect.objectContaining({ durationHours: 24, replaces: first.active!.id }),
    ]);
    expect(await tenantLog('support.revoked')).toHaveLength(1);
  });

  it('owner only; durations are 1, 24 or 72 hours', async () => {
    expect((await b.staff.get(`${C}/support-grants`)).statusCode).toBe(403);
    expect((await b.staff.post(`${C}/support-grants`, { durationHours: 1 })).statusCode).toBe(403);
    const odd = await b.owner.post(`${C}/support-grants`, { durationHours: 2 });
    expect(odd.statusCode).toBe(400);
  });

  it('still works while the business is suspended, so Tempora can help', async () => {
    const admin = await flows.login();
    await admin.post(`${A}/tenants/${tenantId}/suspend`, { reason: 'Review' });
    expect((await b.owner.post(`${C}/branches`, { name: 'Harbor' })).statusCode).toBe(423);
    await grant(1);
  });
});

describe('support views in the Platform Admin (FSD 1.4, 3.10, 5.5)', () => {
  async function readEverything(admin: TestBrowser) {
    const bookings = await admin.get(support('/bookings'));
    expect(bookings.statusCode, bookings.body).toBe(200);
    expect(bookings.headers['cache-control']).toBe('no-store');
    const booking = await admin.get(support(`/bookings/${bookingId}`));
    const customers = await admin.get(support('/customers'));
    const customerId = customers.json<{ items: { id: string }[] }>().items[0]!.id;
    const customer = await admin.get(support(`/customers/${customerId}`));
    const invoices = await admin.get(support('/invoices'));
    const invoiceId = invoices.json<{ items: { id: string }[] }>().items[0]!.id;
    const invoice = await admin.get(support(`/invoices/${invoiceId}`));
    return { bookings, booking, customers, customer, invoices, invoice };
  }

  it('closed without a grant: nothing to read, nothing logged in the tenant', async () => {
    const admin = await flows.login();
    const refused = await admin.get(support('/bookings'));
    expect(refused.statusCode).toBe(403);
    expect(code(refused)).toBe('SUPPORT_ACCESS_REQUIRED');
    expect((await admin.get(`${A}/tenants/${tenantId}`)).json()).toMatchObject({
      supportAccess: null,
    });
    expect(await tenantLog('support.viewed')).toHaveLength(0);
  });

  it('with a grant: what the owner sees, read only, every view in the tenant log', async () => {
    const granted = await grant(1);
    const admin = await flows.login();
    expect((await admin.get(`${A}/tenants/${tenantId}`)).json()).toMatchObject({
      supportAccess: { expiresAt: granted.active!.expiresAt },
    });

    const views = await readEverything(admin);
    expect(views.bookings.json()).toMatchObject({ total: 1, items: [{ id: bookingId }] });
    expect(views.booking.json()).toMatchObject({
      id: bookingId,
      customer: { email: 'omar@veloria.test' },
      timeline: [],
      actions: { reschedule: false, reassign: false, cancel: false, complete: false },
    });
    expect(views.customers.json()).toMatchObject({ total: 1, items: [{ bookingCount: 1 }] });
    expect(views.customer.json()).toMatchObject({ bookings: [{ id: bookingId }] });
    expect(views.invoices.json()).toMatchObject({ total: 1, items: [{ status: 'paid' }] });
    expect(views.invoice.json()).toMatchObject({ booking: { id: bookingId } });

    const logged = await tenantLog('support.viewed');
    expect(logged.map((e) => (e.after as { view: string }).view)).toEqual([
      'bookings',
      'booking',
      'customers',
      'customer',
      'invoices',
      'invoice',
    ]);
    expect(logged[0]).toMatchObject({
      actorType: 'platform_admin',
      actorLabel: 'Ines Halvorsen (Tempora support)',
      entityId: granted.active!.id,
    });
    expect(
      await h.owner.auditLog.count({ where: { tenantId: null, action: 'support.viewed' } }),
    ).toBe(6);
  });

  it('stops at once when the owner revokes, and when the grant expires', async () => {
    const { active } = await grant(1);
    const admin = await flows.login();
    expect((await admin.get(support('/bookings'))).statusCode).toBe(200);
    await b.owner.request('DELETE', `${C}/support-grants/${active!.id}`);
    expect(code(await admin.get(support('/bookings')))).toBe('SUPPORT_ACCESS_REQUIRED');

    await grant(1);
    h.clock.advance(61 * MINUTE);
    const later = await flows.login(); // the admin session idled out too
    expect(code(await later.get(support('/bookings')))).toBe('SUPPORT_ACCESS_REQUIRED');
  });

  it('every view needs a fresh step-up', async () => {
    await grant(24);
    const admin = await flows.login();
    h.clock.advance(11 * MINUTE);
    // The check comes before the record is looked up, so any ID shows it.
    const anyId = 'fa1d0000-0000-4000-8000-000000004217';
    for (const view of ['bookings', 'customers', 'invoices']) {
      expect(code(await admin.get(support(`/${view}`)))).toBe('STEP_UP_REQUIRED');
      expect(code(await admin.get(support(`/${view}/${anyId}`)))).toBe('STEP_UP_REQUIRED');
    }
    expect(await tenantLog('support.viewed')).toHaveLength(0);
    await flows.stepUp(admin);
    expect((await admin.get(support('/customers'))).statusCode).toBe(200);
  });

  it("one tenant's grant opens nothing of another tenant", async () => {
    const other = await bookableBusiness(h, SECOND_OWNER, {
      name: 'Mira Santos',
      email: 'mira@veloria.test',
    });
    const otherBooking = (await paidBooking(h, other, nyTime(nextWeekday(2), '11:00'))).booking.id;
    const otherTenant = (await h.owner.tenant.findUniqueOrThrow({ where: { slug: 'harbor' } })).id;
    await grant(1);
    const admin = await flows.login();

    // Through the granting tenant's path, the other tenant's booking does not exist.
    expect((await admin.get(support(`/bookings/${otherBooking}`))).statusCode).toBe(404);
    // And the other tenant has granted nothing.
    const refused = await admin.get(`${A}/tenants/${otherTenant}/support/bookings`);
    expect(code(refused)).toBe('SUPPORT_ACCESS_REQUIRED');
  });
});

describe('support context in the database (FSD 4.4)', () => {
  it('reads the granting tenant only, writes nothing but support.viewed', async () => {
    const { active } = await grant(1);
    const ctx = { supportGrantId: active!.id };

    const seen = await withDbContext(h.prisma, ctx, (tx) => tx.booking.count());
    expect(seen).toBe(1);
    const changed = await withDbContext(h.prisma, ctx, (tx) =>
      tx.booking.updateMany({ data: { customerNotes: 'changed by support' } }),
    );
    expect(changed.count).toBe(0);
    await expect(
      withDbContext(h.prisma, ctx, (tx) =>
        tx.branch.create({ data: { tenantId, name: 'Not allowed' } }),
      ),
    ).rejects.toThrow(/row-level security/);
    await expect(
      withDbContext(h.prisma, ctx, (tx) =>
        tx.auditLog.createMany({
          data: [
            {
              tenantId,
              actorType: 'platform_admin',
              actorLabel: 'Support',
              action: 'booking.cancelled',
              entityType: 'booking',
            },
          ],
        }),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it('a revoked or expired grant opens nothing, whatever the API thinks', async () => {
    const { active } = await grant(1);
    // Expired on the database clock (the API clock is not consulted).
    await h.owner.supportGrant.update({
      where: { id: active!.id },
      data: {
        startsAt: new Date(Date.now() - 2 * 60 * MINUTE),
        expiresAt: new Date(Date.now() - 60 * MINUTE),
      },
    });
    const ctx = { supportGrantId: active!.id };
    expect(await withDbContext(h.prisma, ctx, (tx) => tx.booking.count())).toBe(0);

    const revoked = await grant(1);
    await b.owner.request('DELETE', `${C}/support-grants/${revoked.active!.id}`);
    expect(
      await withDbContext(h.prisma, { supportGrantId: revoked.active!.id }, (tx) =>
        tx.tenantCustomer.count(),
      ),
    ).toBe(0);
  });

  it('the shared Console queries run with the grant alone, never the tenant', async () => {
    // A viewer whose grant was revoked after the API's check: the queries must find nothing,
    // which only holds if they run in the support context (not the tenant's).
    const { active } = await grant(1);
    await b.owner.request('DELETE', `${C}/support-grants/${active!.id}`);
    const viewer = {
      role: 'owner' as const,
      branchId: null,
      membershipId: '',
      tenantId,
      supportGrantId: active!.id,
    };
    const records = createConsoleRecordsService({ prisma: h.prisma, timeZone: 'America/New_York' });
    const bookings = createConsoleBookingService({
      prisma: h.prisma,
      payments: h.payments,
      hashToken: () => '',
      portalUrl: 'http://localhost:3000',
      timeZone: 'America/New_York',
    });
    const page = { page: 1, pageSize: 25 };
    expect((await records.customers(viewer, { sort: 'name', ...page })).total).toBe(0);
    expect((await records.invoices(viewer, page)).total).toBe(0);
    expect((await bookings.list(viewer, { sort: 'startsAt', ...page })).total).toBe(0);
    await expect(bookings.detail(viewer, bookingId)).rejects.toMatchObject({ status: 404 });
  });

  it('at most one active grant per tenant (exclusion constraint)', async () => {
    const { active } = await grant(1);
    const current = await h.owner.supportGrant.findUniqueOrThrow({ where: { id: active!.id } });
    await expect(
      h.owner.supportGrant.create({
        data: {
          tenantId,
          grantedByMembershipId: current.grantedByMembershipId,
          startsAt: current.startsAt,
          expiresAt: current.expiresAt,
        },
      }),
    ).rejects.toThrow(/support_grants_one_active|23P01/);
  });
});
