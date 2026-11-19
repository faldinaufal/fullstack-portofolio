// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { C, consoleFlows, OWNER, PEOPLE } from '../../test/console-flows.js';
import { createHarness, TestBrowser, type Harness } from '../../test/harness.js';
import { todayIn } from '../availability/engine.js';

let h: Harness;
let flows: ReturnType<typeof consoleFlows>;
beforeAll(async () => {
  h = await createHarness();
  flows = consoleFlows(h);
});
afterAll(async () => {
  await h.close();
});
beforeEach(async () => {
  await h.reset();
});

const P = '/v1/public';
const NY = 'America/New_York';

/** The next date (in New York) with the given weekday, at least 2 days ahead. */
function nextWeekday(weekday: number): string {
  const today = todayIn(NY, new Date());
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 2);
  while (d.getUTCDay() !== weekday) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * A business customers can book: Downtown open Mon–Fri 09:00–18:00, a 60-minute massage
 * with a 15-minute buffer, and Ines working Mondays 09:00–13:00.
 */
async function bookableBusiness(input = OWNER, therapist = PEOPLE.ines) {
  const owner = await flows.signUp(input);
  const branch = await flows.createBranch(owner, 'Downtown');
  await owner.request('PUT', `${C}/branches/${branch.id}/opening-hours`, {
    hours: [1, 2, 3, 4, 5].map((weekday) => ({ weekday, opensAt: '09:00', closesAt: '18:00' })),
  });
  const service = (
    await owner.post(`${C}/services`, {
      name: 'Deep Tissue Massage',
      durationMinutes: 60,
      bufferMinutes: 15,
      priceCents: 4217,
    })
  ).json<{ id: string }>();
  const { membershipId } = await flows.addMember(owner, therapist, 'staff', branch.id);
  await owner.request('PUT', `${C}/members/${membershipId}/working-hours`, {
    hours: [{ weekday: 1, startsAt: '09:00', endsAt: '13:00' }],
  });
  await owner.request('PUT', `${C}/members/${membershipId}/services`, { serviceIds: [service.id] });
  return {
    owner,
    branchId: branch.id,
    serviceId: service.id,
    staffId: membershipId,
    slug: input.slug,
  };
}

const visitor = () => new TestBrowser(h.app);

describe('directory', () => {
  it('lists only businesses that can take bookings, searchable by name or service', async () => {
    await bookableBusiness();
    await flows.signUp({
      ...OWNER,
      email: 'daniel@veloria.test',
      businessName: 'Harbor Physio Clinic',
      slug: 'harbor',
    });

    const all = (await visitor().get(`${P}/tenants`)).json<{ items: { slug: string }[] }>();
    expect(all.items.map((t) => t.slug)).toEqual(['lumen']); // Harbor's setup is not complete

    expect((await visitor().get(`${P}/tenants?q=massage`)).json()).toMatchObject({
      items: [{ slug: 'lumen', branchNames: ['Downtown'], serviceNames: ['Deep Tissue Massage'] }],
    });
    expect((await visitor().get(`${P}/tenants?q=yoga`)).json()).toEqual({ items: [] });
    // LIKE wildcards typed by a visitor are literal, not "match everything".
    expect((await visitor().get(`${P}/tenants?q=%25`)).json()).toEqual({ items: [] });
  });
});

describe('business and branch pages', () => {
  it('show branches, hours, services and therapists by first name and initial', async () => {
    const { branchId, serviceId, staffId } = await bookableBusiness();

    const page = await visitor().get(`${P}/tenants/lumen`);
    expect(page.json()).toMatchObject({
      name: OWNER.businessName,
      available: true,
      timeZone: NY,
      branches: [
        {
          id: branchId,
          name: 'Downtown',
          openingHours: expect.arrayContaining([
            { weekday: 1, opensAt: '09:00', closesAt: '18:00' },
          ]),
        },
      ],
      services: [{ id: serviceId, priceCents: 4217, durationMinutes: 60 }],
    });

    const branch = await visitor().get(`${P}/tenants/lumen/branches/${branchId}`);
    expect(branch.json()).toMatchObject({
      therapists: [{ id: staffId, displayName: 'Ines H.', serviceIds: [serviceId] }],
      services: [{ id: serviceId }],
    });
    expect(JSON.stringify(branch.json())).not.toContain('veloria.test'); // no emails leak

    expect((await visitor().get(`${P}/tenants/harbor`)).statusCode).toBe(404);
  });
});

describe('availability (FSD 6.2)', () => {
  it('lists the free slots of a working day and nothing on other days', async () => {
    const b = await bookableBusiness();
    const monday = nextWeekday(1);
    const query = (date: string) =>
      `${P}/tenants/lumen/availability?branchId=${b.branchId}&serviceId=${b.serviceId}&staffId=${b.staffId}&date=${date}`;

    const slots = (await visitor().get(query(monday))).json<{ slots: { startsAt: string }[] }>();
    const times = slots.slots.map((s) =>
      new Date(s.startsAt).toLocaleTimeString('en-GB', {
        timeZone: NY,
        hour: '2-digit',
        minute: '2-digit',
      }),
    );
    expect(times).toEqual(['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00']);

    expect((await visitor().get(query(nextWeekday(2)))).json()).toMatchObject({ slots: [] }); // not working
  });

  it('removes slots blocked by time off and by a branch closure', async () => {
    const b = await bookableBusiness();
    const monday = nextWeekday(1);
    const query = `${P}/tenants/lumen/availability?branchId=${b.branchId}&serviceId=${b.serviceId}&staffId=${b.staffId}&date=${monday}`;

    // Time off 10:00–11:00 New York, taken from the slot list so no time zone math is needed.
    const all = (await visitor().get(query)).json<{ slots: { startsAt: string }[] }>().slots;
    const tenOClock = all[2]!.startsAt; // 10:00
    const elevenOClock = all[4]!.startsAt; // 11:00
    await b.owner.post(`${C}/members/${b.staffId}/time-off`, {
      startsAt: tenOClock,
      endsAt: elevenOClock,
    });
    const afterTimeOff = (await visitor().get(query)).json<{ slots: { startsAt: string }[] }>()
      .slots;
    // The buffer counts too: 09:00 + 60 min + 15 min buffer runs to 10:15, so 09:00 to 10:30
    // are blocked and 11:00 is the first free start.
    expect(afterTimeOff.map((s) => s.startsAt)).toEqual(all.slice(4).map((s) => s.startsAt));

    await b.owner.post(`${C}/branches/${b.branchId}/closures`, {
      startsOn: monday,
      endsOn: monday,
      reason: 'Holiday',
    });
    expect((await visitor().get(query)).json()).toMatchObject({ slots: [] });
  });

  it('checks rule 1: the therapist must work at the branch and perform the service', async () => {
    const b = await bookableBusiness();
    const physio = (
      await b.owner.post(`${C}/services`, {
        name: 'Sports Physiotherapy',
        durationMinutes: 45,
        bufferMinutes: 0,
        priceCents: 6000,
      })
    ).json<{ id: string }>();
    const monday = nextWeekday(1);

    const notOffered = await visitor().get(
      `${P}/tenants/lumen/availability?branchId=${b.branchId}&serviceId=${physio.id}&staffId=${b.staffId}&date=${monday}`,
    );
    expect(notOffered.json()).toMatchObject({ code: 'SERVICE_NOT_OFFERED' });

    const invalidDate = await visitor().get(
      `${P}/tenants/lumen/availability?branchId=${b.branchId}&serviceId=${b.serviceId}&staffId=${b.staffId}&date=next-monday`,
    );
    expect(invalidDate.statusCode).toBe(400);
  });

  it("never reveals another business's records through a slug", async () => {
    await bookableBusiness();
    const harbor = await bookableBusiness(
      {
        ...OWNER,
        email: 'daniel@veloria.test',
        businessName: 'Harbor Physio Clinic',
        slug: 'harbor',
      },
      PEOPLE.omar,
    );
    const crossed = await visitor().get(
      `${P}/tenants/lumen/availability?branchId=${harbor.branchId}&serviceId=${harbor.serviceId}&staffId=${harbor.staffId}&date=${nextWeekday(1)}`,
    );
    expect(crossed.statusCode).toBe(404);
    expect((await visitor().get(`${P}/tenants/lumen/branches/${harbor.branchId}`)).statusCode).toBe(
      404,
    );
  });

  it('a suspended business shows as unavailable and takes no bookings (FSD 6.9)', async () => {
    const b = await bookableBusiness();
    await h.owner.tenant.update({
      where: { slug: 'lumen' },
      data: { status: 'suspended', suspendedAt: new Date(), suspensionReason: 'Review' },
    });

    expect((await visitor().get(`${P}/tenants/lumen`)).json()).toMatchObject({ available: false });
    expect((await visitor().get(`${P}/tenants`)).json()).toEqual({ items: [] });
    const blocked = await visitor().get(
      `${P}/tenants/lumen/availability?branchId=${b.branchId}&serviceId=${b.serviceId}&staffId=${b.staffId}&date=${nextWeekday(1)}`,
    );
    expect(blocked.statusCode).toBe(423);
  });
});
