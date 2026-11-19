// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { C, consoleFlows, PEOPLE } from '../../test/console-flows.js';
import { createHarness, type Harness, type TestBrowser } from '../../test/harness.js';

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

const MASSAGE = {
  name: 'Deep Tissue Massage',
  durationMinutes: 60,
  bufferMinutes: 15,
  priceCents: 4217,
};

async function createService(owner: TestBrowser, input = MASSAGE) {
  const response = await owner.post(`${C}/services`, input);
  expect(response.statusCode).toBe(201);
  return response.json<{ id: string; version: number }>();
}

/** Downtown open Monday–Friday 09:00–18:00. */
async function openWeekdays(owner: TestBrowser, branchId: string) {
  const response = await owner.request('PUT', `${C}/branches/${branchId}/opening-hours`, {
    hours: [1, 2, 3, 4, 5].map((weekday) => ({ weekday, opensAt: '09:00', closesAt: '18:00' })),
  });
  expect(response.statusCode).toBe(200);
}

describe('business settings', () => {
  it('owner updates name and booking settings; managers can only read', async () => {
    const owner = await flows.signUp();
    const branch = await flows.createBranch(owner, 'Downtown');
    const { browser: manager } = await flows.addMember(owner, PEOPLE.daniel, 'manager', branch.id);

    const settings = (await owner.get(`${C}/tenant`)).json<{ version: number }>();
    expect(settings).toMatchObject({
      bookingSettings: {
        minLeadHours: 4,
        maxAdvanceDays: 30,
        cancellationCutoffHours: 24,
        maxCustomerReschedules: 2,
      },
    });

    const updated = await owner.request(
      'PATCH',
      `${C}/tenant`,
      { name: 'Lumen Studio', bookingSettings: { minLeadHours: 2, maxAdvanceDays: 60 } },
      { 'if-match': String(settings.version) },
    );
    expect(updated.json()).toMatchObject({
      name: 'Lumen Studio',
      bookingSettings: { minLeadHours: 2, maxAdvanceDays: 60, cancellationCutoffHours: 24 },
    });

    const invalid = await owner.request(
      'PATCH',
      `${C}/tenant`,
      { bookingSettings: { maxAdvanceDays: 0 } },
      { 'if-match': String(settings.version + 1) },
    );
    expect(invalid.statusCode).toBe(400);

    expect((await manager.get(`${C}/tenant`)).statusCode).toBe(200);
    const managerEdit = await manager.request(
      'PATCH',
      `${C}/tenant`,
      { name: 'Mine now' },
      { 'if-match': '2' },
    );
    expect(managerEdit.statusCode).toBe(403);
  });
});

describe('service catalogue', () => {
  it('owner creates and edits services; staff and managers read them', async () => {
    const owner = await flows.signUp();
    const branch = await flows.createBranch(owner, 'Downtown');
    const { browser: staff } = await flows.addMember(owner, PEOPLE.ines, 'staff', branch.id);
    const service = await createService(owner);

    const list = (await staff.get(`${C}/services`)).json<{
      items: { name: string; priceCents: number }[];
    }>();
    expect(list.items).toEqual([expect.objectContaining({ name: MASSAGE.name, priceCents: 4217 })]);
    expect((await staff.post(`${C}/services`, MASSAGE)).statusCode).toBe(403);

    const priced = await owner.request(
      'PATCH',
      `${C}/services/${service.id}`,
      { priceCents: 5000 },
      {
        'if-match': String(service.version),
      },
    );
    expect(priced.json()).toMatchObject({ priceCents: 5000, version: service.version + 1 });
    const stale = await owner.request(
      'PATCH',
      `${C}/services/${service.id}`,
      { priceCents: 6000 },
      {
        'if-match': String(service.version),
      },
    );
    expect(stale.json()).toMatchObject({ code: 'VERSION_CONFLICT' });
  });

  it('rejects durations, buffers and prices outside the rules (FSD 6.12)', async () => {
    const owner = await flows.signUp();
    for (const bad of [
      { durationMinutes: 20 },
      { durationMinutes: 495 },
      { bufferMinutes: 7 },
      { priceCents: -1 },
      { priceCents: 1_000_001 },
    ]) {
      const response = await owner.post(`${C}/services`, { ...MASSAGE, ...bad });
      expect(response.statusCode, JSON.stringify(bad)).toBe(400);
    }
  });
});

describe('therapist schedules', () => {
  it('working hours must fit inside the branch opening hours', async () => {
    const owner = await flows.signUp();
    const branch = await flows.createBranch(owner, 'Downtown');
    await openWeekdays(owner, branch.id);
    const { membershipId } = await flows.addMember(owner, PEOPLE.ines, 'staff', branch.id);

    const ok = await owner.request('PUT', `${C}/members/${membershipId}/working-hours`, {
      hours: [{ weekday: 1, startsAt: '09:00', endsAt: '17:00' }],
    });
    expect(ok.json()).toMatchObject({
      workingHours: [{ weekday: 1, startsAt: '09:00', endsAt: '17:00' }],
    });

    const tooLate = await owner.request('PUT', `${C}/members/${membershipId}/working-hours`, {
      hours: [
        { weekday: 1, startsAt: '09:00', endsAt: '17:00' },
        { weekday: 2, startsAt: '12:00', endsAt: '19:00' },
        { weekday: 6, startsAt: '10:00', endsAt: '14:00' },
      ],
    });
    expect(tooLate.statusCode).toBe(409);
    expect(tooLate.json()).toMatchObject({
      code: 'OUTSIDE_BRANCH_HOURS',
      errors: [{ path: 'hours.1' }, { path: 'hours.2' }],
    });
  });

  it('managers edit schedules of their own branch only; the owner has none', async () => {
    const owner = await flows.signUp();
    const downtown = await flows.createBranch(owner, 'Downtown');
    const riverside = await flows.createBranch(owner, 'Riverside');
    await openWeekdays(owner, downtown.id);
    await openWeekdays(owner, riverside.id);
    const { browser: manager } = await flows.addMember(
      owner,
      PEOPLE.daniel,
      'manager',
      downtown.id,
    );
    const { membershipId: ines } = await flows.addMember(owner, PEOPLE.ines, 'staff', downtown.id);
    const { membershipId: omar } = await flows.addMember(owner, PEOPLE.omar, 'staff', riverside.id);
    const hours = { hours: [{ weekday: 3, startsAt: '10:00', endsAt: '16:00' }] };

    expect(
      (await manager.request('PUT', `${C}/members/${ines}/working-hours`, hours)).statusCode,
    ).toBe(200);
    expect(
      (await manager.request('PUT', `${C}/members/${omar}/working-hours`, hours)).statusCode,
    ).toBe(404);

    const ownerId = (await owner.get(`${C}/me`)).json<{ activeMembership: { id: string } }>()
      .activeMembership.id;
    const ownerHours = await owner.request('PUT', `${C}/members/${ownerId}/working-hours`, hours);
    expect(ownerHours.json()).toMatchObject({ code: 'NOT_A_THERAPIST' });
  });

  it('assigns active services only; archiving a service removes it from therapists', async () => {
    const owner = await flows.signUp();
    const branch = await flows.createBranch(owner, 'Downtown');
    const { membershipId } = await flows.addMember(owner, PEOPLE.ines, 'staff', branch.id);
    const massage = await createService(owner);
    const physio = await createService(owner, { ...MASSAGE, name: 'Sports Physiotherapy' });

    const assigned = await owner.request('PUT', `${C}/members/${membershipId}/services`, {
      serviceIds: [massage.id, physio.id],
    });
    expect(assigned.json<{ services: unknown[] }>().services).toHaveLength(2);

    await owner.post(`${C}/services/${physio.id}/archive`);
    const detail = (await owner.get(`${C}/members/${membershipId}`)).json<{
      services: { id: string }[];
    }>();
    expect(detail.services.map((s) => s.id)).toEqual([massage.id]);

    const archived = await owner.request('PUT', `${C}/members/${membershipId}/services`, {
      serviceIds: [physio.id],
    });
    expect(archived.statusCode).toBe(404);
  });

  it('staff manage their own time off; limits apply', async () => {
    const owner = await flows.signUp();
    const branch = await flows.createBranch(owner, 'Downtown');
    const { browser: ines, membershipId: inesId } = await flows.addMember(
      owner,
      PEOPLE.ines,
      'staff',
      branch.id,
    );
    const { membershipId: omarId } = await flows.addMember(owner, PEOPLE.omar, 'staff', branch.id);
    const day = 24 * 60 * 60_000;
    const at = (days: number) => new Date(Date.now() + days * day).toISOString();

    const created = await ines.post(`${C}/members/${inesId}/time-off`, {
      startsAt: at(3),
      endsAt: at(4),
      reason: 'Dentist',
    });
    expect(created.statusCode).toBe(201);
    const { id } = created.json<{ id: string }>();

    expect(
      (await ines.post(`${C}/members/${omarId}/time-off`, { startsAt: at(3), endsAt: at(4) }))
        .statusCode,
    ).toBe(404);
    expect(
      (await ines.post(`${C}/members/${inesId}/time-off`, { startsAt: at(-3), endsAt: at(-2) }))
        .statusCode,
    ).toBe(400);
    expect(
      (await ines.post(`${C}/members/${inesId}/time-off`, { startsAt: at(1), endsAt: at(100) }))
        .statusCode,
    ).toBe(400);
    expect((await ines.get(`${C}/members/${omarId}`)).statusCode).toBe(404);

    const mine = (await ines.get(`${C}/members/${inesId}`)).json<{ timeOff: { id: string }[] }>();
    expect(mine.timeOff.map((t) => t.id)).toEqual([id]);
    expect((await ines.request('DELETE', `${C}/members/${inesId}/time-off/${id}`)).statusCode).toBe(
      204,
    );
  });
});

describe('setup status (FSD 3.4)', () => {
  it('is complete once a therapist with hours and services can be booked', async () => {
    const owner = await flows.signUp();
    const setup = async () =>
      (await owner.get(`${C}/tenant`)).json<{ setup: Record<string, boolean> }>().setup;
    expect(await setup()).toEqual({
      hasBranch: false,
      hasService: false,
      hasBookableTherapist: false,
      complete: false,
    });

    const branch = await flows.createBranch(owner, 'Downtown');
    await openWeekdays(owner, branch.id);
    const service = await createService(owner);
    expect(await setup()).toMatchObject({ hasBranch: true, hasService: true, complete: false });

    const { membershipId } = await flows.addMember(owner, PEOPLE.ines, 'staff', branch.id);
    await owner.request('PUT', `${C}/members/${membershipId}/working-hours`, {
      hours: [{ weekday: 1, startsAt: '09:00', endsAt: '17:00' }],
    });
    await owner.request('PUT', `${C}/members/${membershipId}/services`, {
      serviceIds: [service.id],
    });
    expect(await setup()).toMatchObject({ hasBookableTherapist: true, complete: true });
  });
});
