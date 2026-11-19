// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { withDbContext } from '@tempora/db';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { A, ADMIN, adminBrowser, adminFlows } from '../../test/admin-flows.js';
import {
  bookableBusiness,
  bookingBody,
  book,
  nextWeekday,
  nyTime,
  paidBooking,
  portalBrowser,
  type BookableBusiness,
} from '../../test/booking-flows.js';
import { C, MEMBER_PASSWORD, OWNER } from '../../test/console-flows.js';
import { createHarness, TestBrowser, type Harness } from '../../test/harness.js';

const MINUTE = 60_000;

let h: Harness;
let b: BookableBusiness;
let flows: ReturnType<typeof adminFlows>;

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
});

const ownerTenantId = async () =>
  (await h.owner.tenant.findUniqueOrThrow({ where: { slug: OWNER.slug } })).id;

describe('Platform Admin login (FSD 5.5, 6.11)', () => {
  it('a code at every login; the session works for this app only', async () => {
    const admin = await flows.login();
    const me = (await admin.get(`${A}/me`)).json<{
      email: string;
      stepUpValidUntil: string | null;
    }>();
    expect(me.email).toBe(ADMIN.email);
    expect(me.stepUpValidUntil).not.toBeNull(); // the login code counts as a step-up

    // App gate: a Console session is not an admin session, and the other way round.
    expect((await b.owner.get(`${A}/me`)).statusCode).toBe(401);
    expect((await admin.get(`${C}/me`)).statusCode).toBe(401);
  });

  it('a wrong password looks like a right one until the code, which is refused the same way', async () => {
    const decoy = await adminBrowser(h).post(`${A}/auth/login`, {
      email: ADMIN.email,
      password: 'not the password at all',
    });
    const unknown = await adminBrowser(h).post(`${A}/auth/login`, {
      email: 'nobody@veloria.test',
      password: 'not the password at all',
    });
    expect(decoy.statusCode).toBe(200);
    expect(unknown.statusCode).toBe(200);
    expect(decoy.json()).toMatchObject({ status: 'otp_required', sentTo: 'o***@veloria.test' });
    expect(await h.owner.emailMessage.count({ where: { template: 'admin.login_code' } })).toBe(0);

    const real = await adminBrowser(h).post(`${A}/auth/login`, ADMIN);
    const tryCode = (challengeId: string) =>
      adminBrowser(h).post(`${A}/auth/verify-otp`, { challengeId, code: '000000' });
    const wrongReal = await tryCode(real.json<{ challengeId: string }>().challengeId);
    const wrongDecoy = await tryCode(decoy.json<{ challengeId: string }>().challengeId);
    expect(wrongReal.statusCode).toBe(401);
    expect(wrongDecoy.statusCode).toBe(401);
    // Same problem body apart from the per-request fields.
    const body = (response: { json: <T>() => T }) => {
      const json = { ...response.json<Record<string, unknown>>() };
      delete json.requestId;
      delete json.instance;
      return json;
    };
    expect(body(wrongDecoy)).toEqual(body(wrongReal));
  });

  it('five wrong codes use the challenge up; the right one then fails too', async () => {
    const browser = adminBrowser(h);
    const challenge = await browser.post(`${A}/auth/login`, ADMIN);
    const challengeId = challenge.json<{ challengeId: string }>().challengeId;
    for (let i = 0; i < 5; i += 1) {
      await browser.post(`${A}/auth/verify-otp`, { challengeId, code: '000000' });
    }
    const right = await browser.post(`${A}/auth/verify-otp`, {
      challengeId,
      code: await flows.codeFor(ADMIN.email),
    });
    expect(right.statusCode).toBe(401);
  });

  it('ends after an hour without activity, and when the admin is disabled', async () => {
    const admin = await flows.login();
    h.clock.advance(61 * MINUTE);
    expect((await admin.get(`${A}/me`)).statusCode).toBe(401);

    const again = await flows.login();
    await h.owner.platformAdmin.update({
      where: { email: ADMIN.email },
      data: { disabledAt: new Date() },
    });
    expect((await again.get(`${A}/me`)).statusCode).toBe(401);
  });
});

describe('step-up before sensitive actions (FSD 6.11)', () => {
  it('after 10 minutes a new code is required, and it only re-verifies its own session', async () => {
    const admin = await flows.login();
    const other = await flows.login();
    h.clock.advance(11 * MINUTE);
    const tenantId = await ownerTenantId();

    const refused = await admin.post(`${A}/tenants/${tenantId}/suspend`, { reason: 'Unpaid fees' });
    expect(refused.json()).toMatchObject({ code: 'STEP_UP_REQUIRED' });

    // A step-up code started by one session does not unlock another.
    const started = await other.post(`${A}/auth/step-up`);
    const stolen = await admin.post(`${A}/auth/step-up/verify`, {
      challengeId: started.json<{ challengeId: string }>().challengeId,
      code: await flows.codeFor(ADMIN.email),
    });
    expect(stolen.statusCode).toBe(401);

    await flows.stepUp(admin);
    const done = await admin.post(`${A}/tenants/${tenantId}/suspend`, { reason: 'Unpaid fees' });
    expect(done.statusCode, done.body).toBe(200);
  });
});

describe('assisted onboarding (FSD 3.5)', () => {
  it('creates the business and invites its owner, who then owns it; both logs record it', async () => {
    const admin = await flows.login();
    const created = await admin.post(`${A}/tenants`, {
      businessName: 'Harbor Bodywork',
      slug: 'harbor',
      ownerEmail: 'jonah@veloria.test',
    });
    expect(created.statusCode, created.body).toBe(201);
    expect(created.json()).toMatchObject({
      slug: 'harbor',
      invoicePrefix: 'HAR',
      onboarding: true,
      owner: null,
      ownerInvitation: { email: 'jonah@veloria.test', status: 'pending' },
    });
    const invitation = await h.lastEmail('jonah@veloria.test', 'console.invitation');
    expect(invitation).toMatchObject({ role: 'owner', inviterName: 'The Tempora team' });

    const token = new URL(invitation!.acceptUrl).pathname.split('/').at(-1)!;
    const accept = await new TestBrowser(h.app).post(`${C}/invitation-links/${token}/accept`, {
      name: 'Jonah Reed',
      password: MEMBER_PASSWORD,
    });
    expect(accept.statusCode, accept.body).toBe(200);
    const id = created.json<{ id: string }>().id;
    expect((await admin.get(`${A}/tenants/${id}`)).json()).toMatchObject({
      owner: { name: 'Jonah Reed', email: 'jonah@veloria.test' },
      ownerInvitation: null,
    });

    const platformLog = (await admin.get(`${A}/audit-logs`)).json<{
      items: { action: string }[];
    }>();
    expect(platformLog.items.map((i) => i.action)).toContain('tenant.created');
    expect(
      await h.owner.auditLog.count({ where: { tenantId: id, action: 'tenant.created' } }),
    ).toBe(1);

    const again = await admin.post(`${A}/tenants`, {
      businessName: 'Another',
      slug: 'harbor',
      ownerEmail: 'someone@veloria.test',
    });
    expect(again.json()).toMatchObject({ code: 'SLUG_TAKEN' });
  });
});

describe('suspension (FSD 3.11, 6.9)', () => {
  it('closes the Portal, makes the Console read only, tells the owner; reactivating restores it', async () => {
    const admin = await flows.login();
    const tenantId = await ownerTenantId();
    const monday = nextWeekday(1);
    const suspended = await admin.post(`${A}/tenants/${tenantId}/suspend`, {
      reason: 'Card payments disputed',
    });
    expect(suspended.json()).toMatchObject({
      status: 'suspended',
      suspensionReason: 'Card payments disputed',
    });

    // Portal: no availability, no booking.
    const slots = await portalBrowser(h).get(
      `/v1/public/tenants/${b.slug}/availability?branchId=${b.branchId}&serviceId=${b.serviceId}&staffId=${b.staffId}&date=${monday}`,
    );
    expect(slots.statusCode).toBe(423);
    expect((await book(portalBrowser(h), bookingBody(b, nyTime(monday, '10:00')))).statusCode).toBe(
      423,
    );

    // Console: reads work, writes do not; the banner data is there; logging out still works.
    const me = (await b.owner.get(`${C}/me`)).json<{
      activeMembership: { tenant: { suspension: { reason: string } | null } };
    }>();
    expect(me.activeMembership.tenant.suspension?.reason).toBe('Card payments disputed');
    expect((await b.owner.get(`${C}/branches`)).statusCode).toBe(200);
    expect((await b.owner.post(`${C}/branches`, { name: 'Harbor' })).json()).toMatchObject({
      code: 'TENANT_SUSPENDED',
    });
    expect(await h.lastEmail(OWNER.email, 'console.tenant_suspended')).toMatchObject({
      reason: 'Card payments disputed',
    });

    const reactivated = await admin.post(`${A}/tenants/${tenantId}/reactivate`);
    expect(reactivated.json()).toMatchObject({ status: 'active', suspensionReason: null });
    expect((await b.owner.post(`${C}/branches`, { name: 'Harbor' })).statusCode).toBe(201);
    expect(await h.lastEmail(OWNER.email, 'console.tenant_reactivated')).toBeDefined();
    expect((await b.owner.post(`${C}/auth/logout`)).statusCode).toBe(204);
  });

  it('existing paid bookings stay; the webhook still confirms a pending payment', async () => {
    const paid = await paidBooking(h, b, nyTime(nextWeekday(1), '10:00'));
    const admin = await flows.login();
    await admin.post(`${A}/tenants/${await ownerTenantId()}/suspend`, { reason: 'Review' });
    expect(
      (await h.owner.booking.findUniqueOrThrow({ where: { id: paid.booking.id } })).status,
    ).toBe('confirmed');
  });
});

describe('tenants and overview (FSD 2.3)', () => {
  it('lists tenants with usage; filters by search and status; counts the platform', async () => {
    await paidBooking(h, b, nyTime(nextWeekday(1), '10:00'));
    const admin = await flows.login();
    await admin.post(`${A}/tenants`, {
      businessName: 'Harbor Bodywork',
      slug: 'harbor',
      ownerEmail: 'jonah@veloria.test',
    });
    const list = async (query = '') =>
      (await admin.get(`${A}/tenants${query}`)).json<{
        items: { slug: string; members: number; recentBookings: number; onboarding: boolean }[];
        total: number;
      }>();

    expect((await list()).total).toBe(2);
    expect((await list('?q=lum')).items).toEqual([
      expect.objectContaining({ slug: 'lumen', members: 2, onboarding: false }),
    ]);
    expect((await list('?status=onboarding')).items.map((t) => t.slug)).toEqual(['harbor']);
    expect((await list('?status=active')).items.map((t) => t.slug)).toEqual(['lumen']);

    const overview = (await admin.get(`${A}/overview`)).json<{
      tenants: { active: number; onboarding: number; suspended: number };
      days: { bookings: number; payments: number }[];
    }>();
    expect(overview.tenants).toEqual({ active: 1, onboarding: 1, suspended: 0 });
    expect(overview.days).toHaveLength(14);
    expect(overview.days.at(-1)).toMatchObject({ bookings: 1, payments: 1 });
  });
});

describe('row-level security for platform entries (FSD 4.4)', () => {
  it('a tenant never sees platform entries, and nobody writes them without an admin context', async () => {
    const admin = await flows.login();
    await admin.post(`${A}/tenants/${await ownerTenantId()}/suspend`, { reason: 'Review' });
    const tenantView = await withDbContext(h.prisma, { tenantId: await ownerTenantId() }, (tx) =>
      tx.auditLog.findMany({ where: { tenantId: null } }),
    );
    expect(tenantView).toEqual([]);
    await expect(
      withDbContext(h.prisma, {}, (tx) =>
        tx.auditLog.create({
          data: {
            tenantId: null,
            actorType: 'system',
            actorLabel: 'Forged',
            action: 'tenant.created',
            entityType: 'tenant',
          },
        }),
      ),
    ).rejects.toThrow();
  });
});
