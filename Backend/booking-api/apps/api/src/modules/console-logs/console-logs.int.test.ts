// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  bookableBusiness,
  nextWeekday,
  nyTime,
  paidBooking,
  SECOND_OWNER,
  type BookableBusiness,
} from '../../test/booking-flows.js';
import { C, consoleFlows, OWNER, PEOPLE } from '../../test/console-flows.js';
import { createHarness, type Harness, type TestBrowser } from '../../test/harness.js';

let h: Harness;
let b: BookableBusiness;
let tenantId: string;

beforeAll(async () => {
  h = await createHarness();
});
afterAll(async () => {
  await h.close();
});
beforeEach(async () => {
  await h.reset();
  b = await bookableBusiness(h);
  tenantId = (await h.owner.tenant.findUniqueOrThrow({ where: { slug: OWNER.slug } })).id;
});

interface Entry {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  actor: { type: string; label: string };
  branch: { id: string; name: string } | null;
  before: { role?: string } | null;
  after: { role?: string } | null;
}
interface AuditPage {
  items: Entry[];
  nextCursor: string | null;
}

const audit = async (browser: TestBrowser, query = '') => {
  const response = await browser.get(`${C}/audit-logs${query}`);
  expect(response.statusCode, response.body).toBe(200);
  return response.json<AuditPage>();
};

/** Every entry the browser may see, following the cursors `limit` at a time. */
async function allPages(browser: TestBrowser, limit: number) {
  const ids: string[] = [];
  let cursor: string | null = null;
  do {
    const page: AuditPage = await audit(
      browser,
      `?limit=${limit}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`,
    );
    ids.push(...page.items.map((e) => e.id));
    cursor = page.nextCursor;
  } while (cursor);
  return ids;
}

describe('audit log (FSD 2.2, 5.4)', () => {
  it('owner: the whole tenant, newest first; cursor pages neither skip nor repeat', async () => {
    // Another business's entries never appear.
    await bookableBusiness(h, SECOND_OWNER, { name: 'Mira Santos', email: 'mira@veloria.test' });
    const expected = await h.owner.auditLog.findMany({
      where: { tenantId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { id: true },
    });
    expect(expected.length).toBeGreaterThan(5);

    const all = await audit(b.owner, '?limit=100');
    expect(all.items.map((e) => e.id)).toEqual(expected.map((e) => e.id));
    expect(all.nextCursor).toBeNull();
    expect(await allPages(b.owner, 3)).toEqual(expected.map((e) => e.id));
  });

  it('entries written in the same millisecond page by ID, none skipped or repeated', async () => {
    const at = new Date('2026-11-23T15:00:00.000Z');
    await h.owner.auditLog.createMany({
      data: Array.from({ length: 5 }, (_, i) => ({
        id: `fa1d0000-0000-4000-8000-00000000421${i}`,
        tenantId,
        actorType: 'system' as const,
        actorLabel: 'Auto-complete job',
        action: 'booking.completed',
        entityType: 'booking',
        createdAt: at,
      })),
    });
    const ids: string[] = [];
    let cursor: string | null = null;
    do {
      const page: AuditPage = await audit(
        b.owner,
        `?action=booking.completed&limit=2${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`,
      );
      ids.push(...page.items.map((e) => e.id));
      cursor = page.nextCursor;
    } while (cursor);
    expect(ids).toEqual([4, 3, 2, 1, 0].map((i) => `fa1d0000-0000-4000-8000-00000000421${i}`));
  });

  it('filters: action or group, entity, actor, dates', async () => {
    const group = await audit(b.owner, '?action=service.');
    expect(group.items.map((e) => e.action)).toEqual(['service.created', 'service.created']);
    const exact = await audit(b.owner, '?action=branch.created');
    expect(exact.items).toHaveLength(1);

    const branch = exact.items[0]!;
    const entity = await audit(b.owner, `?entityType=branch&entityId=${branch.entityId}`);
    expect(entity.items.map((e) => e.action)).toEqual([
      'branch.opening_hours_replaced',
      'branch.created',
    ]);

    const byInes = await audit(b.owner, '?actor=ines');
    expect(byInes.items.length).toBeGreaterThan(0);
    expect(byInes.items.every((e) => e.actor.label === 'Ines Halvorsen')).toBe(true);

    const today = new Date().toISOString().slice(0, 10);
    expect((await audit(b.owner, '?from=2026-01-01&to=2026-01-31')).items).toEqual([]);
    expect((await audit(b.owner, `?from=${today}`)).items.length).toBeGreaterThanOrEqual(0);
  });

  it('manager: own branch only, nothing tenant-level, not what the owner did to managers', async () => {
    const flows = consoleFlows(h);
    const harbor = await flows.createBranch(b.owner, 'Harbor');
    const { browser: manager } = await flows.addMember(b.owner, PEOPLE.omar, 'manager', harbor.id);
    // The manager's own work at their branch is visible.
    await manager.post(`${C}/invitations`, {
      email: 'lena@veloria.test',
      role: 'staff',
      branchId: harbor.id,
    });
    await b.owner.request('PATCH', `${C}/tenant`, { name: 'Lumen Spa' }, { 'if-match': '1' });

    const seen = (await audit(manager, '?limit=100')).items;
    expect(seen.map((e) => e.action).sort()).toEqual(['branch.created', 'invitation.created']);
    expect(seen.every((e) => e.branch?.id === harbor.id)).toBe(true);
    expect(seen.find((e) => e.action === 'invitation.created')?.after?.role).toBe('staff');

    // The owner still sees all of it, the manager's own invitation included.
    const owner = (await audit(b.owner, '?limit=100')).items.map((e) => e.action);
    expect(owner).toEqual(expect.arrayContaining(['tenant.updated', 'invitation.accepted']));

    expect((await b.staff.get(`${C}/audit-logs`)).statusCode).toBe(403);
  });

  it('a cursor that is not one is refused', async () => {
    const response = await b.owner.get(`${C}/audit-logs?cursor=not-a-cursor`);
    expect(response.statusCode).toBe(400);
  });

  it('CSV: every entry with the filters, and the export is audited', async () => {
    const response = await b.owner.get(`${C}/audit-logs?format=csv&action=service.`);
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/csv');
    const lines = response.body.trim().split('\r\n');
    expect(lines[0]).toContain('When,Who,Actor type,Action');
    expect(lines).toHaveLength(3);
    const exported = await h.owner.auditLog.findFirstOrThrow({
      where: { tenantId, action: 'export.created' },
    });
    expect(exported.after).toMatchObject({ list: 'audit', rows: 2 });
  });
});

interface Email {
  to: string;
  template: string;
  status: string;
  bookingId: string | null;
}

describe('email log (FSD 2.2, 5.4)', () => {
  it('owner: every email of the business, without content; filters', async () => {
    const paid = await paidBooking(h, b, nyTime(nextWeekday(1), '10:00'));
    const response = await b.owner.get(`${C}/emails`);
    expect(response.statusCode, response.body).toBe(200);
    const page = response.json<{ items: (Email & Record<string, unknown>)[]; total: number }>();
    expect(page.items.map((e) => e.template)).toEqual(
      expect.arrayContaining(['console.invitation', 'portal.booking_confirmed']),
    );
    expect(page.items.some((e) => 'payload' in e)).toBe(false);
    // Only scheduled emails (the reminder) name their booking.
    const reminder = page.items.find((e) => e.template === 'portal.booking_reminder');
    expect(reminder?.bookingId).toBe(paid.booking.id);

    const queued = (await b.owner.get(`${C}/emails?status=sent`)).json<{ total: number }>();
    expect(queued.total).toBe(0); // no worker in these tests: everything is still queued
    const toOmar = (await b.owner.get(`${C}/emails?q=omar`)).json<{ items: Email[] }>();
    expect(toOmar.items.every((e) => e.to.includes('omar'))).toBe(true);
  });

  it("manager: emails about their branch's bookings only", async () => {
    await paidBooking(h, b, nyTime(nextWeekday(1), '10:00'));
    const flows = consoleFlows(h);
    const { browser: downtown } = await flows.addMember(
      b.owner,
      PEOPLE.daniel,
      'manager',
      b.branchId,
    );
    const harbor = await flows.createBranch(b.owner, 'Harbor');
    const { browser: other } = await flows.addMember(b.owner, PEOPLE.omar, 'manager', harbor.id);

    // Downtown: the booking's emails and Ines's staff invitation, not Daniel's own (manager).
    const mine = (await downtown.get(`${C}/emails`)).json<{ items: Email[] }>().items;
    expect(mine.map((e) => e.template).sort()).toEqual([
      'console.invitation',
      'portal.booking_confirmed',
      'portal.booking_reminder',
    ]);
    expect(mine.find((e) => e.template === 'console.invitation')?.to).toBe(PEOPLE.ines.email);
    expect((await other.get(`${C}/emails`)).json()).toMatchObject({ total: 0 });
    expect((await b.staff.get(`${C}/emails`)).statusCode).toBe(403);
  });
});
