// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createArgon2PasswordHasher } from '../../lib/passwords.js';
import { A, adminFlows } from '../../test/admin-flows.js';
import { portalBrowser } from '../../test/booking-flows.js';
import { C, consoleFlows } from '../../test/console-flows.js';
import { createHarness, type Harness } from '../../test/harness.js';
import { DEMO_TENANT_IDS } from './plan.js';
import { seedDemo } from './seed.js';
import { DEMO_ACCOUNTS } from './world.js';

const PASSWORD = 'tempora-demo-2026';

let h: Harness;
let passwordHash: string;

beforeAll(async () => {
  h = await createHarness();
  passwordHash = await createArgon2PasswordHasher().hash(PASSWORD);
});
afterAll(async () => {
  await h.close();
});
beforeEach(async () => {
  await h.reset();
});

const seed = (reset = false, emailDomain?: string) =>
  seedDemo(
    h.owner,
    {
      now: new Date(),
      timeZone: 'America/New_York',
      passwordHash,
      portalUrl: 'http://localhost:3000',
      ...(emailDomain && { emailDomain }),
    },
    { reset },
  );

const consoleLogin = (email: string) => consoleFlows(h).login(email, PASSWORD);

describe('demo seed (FSD 10.3)', () => {
  it('every demo role logs in and sees a business full of data, within its scope', async () => {
    expect((await seed()).seeded).toBe(true);

    const owner = await consoleLogin(DEMO_ACCOUNTS.owner.email);
    const overview = (await owner.get(`${C}/reports/overview`)).json<{
      branches: number;
      activeTherapists: number;
      revenueLastMonthCents: number;
      utilization: number | null;
    }>();
    expect(overview.branches).toBe(3);
    expect(overview.activeTherapists).toBeGreaterThanOrEqual(5);
    expect(overview.revenueLastMonthCents).toBeGreaterThan(0);
    expect(overview.utilization).toBeGreaterThan(0.2);
    const all = (await owner.get(`${C}/bookings?pageSize=1`)).json<{ total: number }>();
    expect(all.total).toBeGreaterThan(1000);
    expect(
      (await owner.get(`${C}/audit-logs?limit=5`)).json<{ items: unknown[] }>().items,
    ).toHaveLength(5);

    // The manager sees Downtown only; the therapist only their own bookings.
    const manager = await consoleLogin(DEMO_ACCOUNTS.manager.email);
    const downtown = (await manager.get(`${C}/bookings?pageSize=100`)).json<{
      total: number;
      items: { branch: { name: string } }[];
    }>();
    expect(downtown.total).toBeLessThan(all.total);
    expect(new Set(downtown.items.map((b) => b.branch.name))).toEqual(new Set(['Downtown']));
    const therapist = await consoleLogin(DEMO_ACCOUNTS.therapist.email);
    // Staff use the calendar (FSD 2.2), which shows their own column only.
    const today = new Date().toISOString().slice(0, 10);
    const week = new Date(Date.now() + 6 * 86_400_000).toISOString().slice(0, 10);
    const own = (await therapist.get(`${C}/calendar?from=${today}&to=${week}`)).json<{
      therapists: { name: string }[];
      bookings: unknown[];
    }>();
    expect(own.therapists.map((t) => t.name)).toEqual([DEMO_ACCOUNTS.therapist.name]);
    expect(own.bookings.length).toBeGreaterThan(0);

    // The customer: My bookings at both businesses.
    const customer = portalBrowser(h);
    const login = await customer.post('/v1/portal/auth/login', {
      email: DEMO_ACCOUNTS.customer.email,
      password: PASSWORD,
    });
    expect(login.statusCode, login.body).toBe(200);
    const mine = (await customer.get('/v1/portal/bookings')).json<{
      items: { business: { name: string } }[];
    }>();
    expect(new Set(mine.items.map((b) => b.business.name))).toEqual(
      new Set(['Lumen Wellness Studio', 'Harbor Physio Clinic']),
    );

    // The platform admin: both businesses, set up and active.
    const admin = await adminFlows(h).login({ ...DEMO_ACCOUNTS.admin, password: PASSWORD });
    const tenants = (await admin.get(`${A}/tenants`)).json<{
      items: { name: string; onboarding: boolean; recentBookings: number }[];
    }>();
    expect(tenants.items.map((t) => t.name).sort()).toEqual([
      'Harbor Physio Clinic',
      'Lumen Wellness Studio',
    ]);
    expect(tenants.items.every((t) => !t.onboarding && t.recentBookings > 0)).toBe(true);
  });

  it('seeds once; a reset undoes what visitors changed and leaves other businesses alone', async () => {
    await seed();
    expect((await seed()).seeded).toBe(false);

    // A visitor's own business, and a change in the demo.
    const visitor = await consoleFlows(h).signUp({
      name: 'Ruth Quinn',
      email: 'ruth.quinn@veloria.test',
      password: 'a long visitor password',
      businessName: 'Quinn Bodywork',
      slug: 'quinn',
    });
    const owner = await consoleLogin(DEMO_ACCOUNTS.owner.email);
    await owner.request(
      'PATCH',
      `${C}/tenant`,
      { name: 'Renamed by a visitor' },
      { 'if-match': '1' },
    );

    expect((await seed(true)).seeded).toBe(true);
    const lumen = await h.owner.tenant.findUniqueOrThrow({ where: { id: DEMO_TENANT_IDS[0]! } });
    expect(lumen.name).toBe('Lumen Wellness Studio');
    // The demo owner's session ended with the reset; the visitor's did not.
    expect((await owner.get(`${C}/me`)).statusCode).toBe(401);
    expect((await visitor.get(`${C}/me`)).statusCode).toBe(200);
    expect(await h.owner.tenant.count({ where: { slug: 'quinn' } })).toBe(1);
  });

  it('a reset leaves no rows of the old demo behind, in any tenant table', async () => {
    await seed();
    const counts = () =>
      Promise.all([
        h.owner.booking.count(),
        h.owner.auditLog.count(),
        h.owner.emailMessage.count(),
      ]);
    const before = await counts();
    await seed(true);
    // Audit entries and emails lose their tenant rather than block its deletion (SET NULL),
    // so they would linger as platform-level rows if the reset skipped them.
    expect(await counts()).toEqual(before);
    expect(await h.owner.auditLog.count({ where: { tenantId: null } })).toBe(0);
    const tables = await h.owner.$queryRaw<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.columns
      WHERE table_schema = 'public' AND column_name = 'tenant_id'`;
    for (const { table_name } of tables) {
      const [row] = await h.owner.$queryRawUnsafe<{ n: number }[]>(
        `SELECT count(*)::int AS n FROM "${table_name}" WHERE tenant_id IS NOT NULL AND tenant_id <> ALL($1::uuid[])`,
        DEMO_TENANT_IDS,
      );
      expect(row!.n, table_name).toBe(0);
    }
  });

  it('a reset under another email domain moves every demo account to it', async () => {
    await seed();
    expect((await seed(true, 'demo.tempora.test')).seeded).toBe(true);

    const owner = await consoleLogin('owner@demo.tempora.test');
    expect((await owner.get(`${C}/reports/overview`)).statusCode).toBe(200);
    const [left] = await h.owner.$queryRaw<[{ n: number }]>`
      SELECT ((SELECT count(*) FROM team_accounts WHERE email LIKE '%@veloria.test')
            + (SELECT count(*) FROM customer_accounts WHERE email LIKE '%@veloria.test')
            + (SELECT count(*) FROM platform_admins WHERE email LIKE '%@veloria.test'))::int AS n`;
    expect(left.n).toBe(0);
  });

  it('refuses to seed over another business that holds a demo address', async () => {
    await consoleFlows(h).signUp({
      name: 'Ruth Quinn',
      email: 'ruth.quinn@veloria.test',
      password: 'a long visitor password',
      businessName: 'Lumen Copy',
      slug: 'lumen',
    });
    await expect(seed()).rejects.toThrow(/already uses a demo address/);
  });

  it('an invoice prefix taken by another business: the demo uses the next free one', async () => {
    // `lumina` gets the prefix LUM at sign-up, the demo's usual one.
    await consoleFlows(h).signUp({
      name: 'Ruth Quinn',
      email: 'ruth.quinn@veloria.test',
      password: 'a long visitor password',
      businessName: 'Lumina Spa',
      slug: 'lumina',
    });
    expect((await seed()).seeded).toBe(true);
    const lumen = await h.owner.tenant.findUniqueOrThrow({ where: { id: DEMO_TENANT_IDS[0]! } });
    expect(lumen.invoicePrefix).toBe('LUM2');
    const invoice = await h.owner.invoice.findFirstOrThrow({ where: { tenantId: lumen.id } });
    expect(invoice.number).toMatch(/^LUM2-\d{4}-\d{6}$/);
  });
});
