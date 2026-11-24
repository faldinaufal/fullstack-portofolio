// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  bookableBusiness,
  bookingBody,
  expectBooked,
  nextWeekday,
  nyTime,
  portalBrowser,
  type BookableBusiness,
} from '../../test/booking-flows.js';
import { C, consoleFlows, PEOPLE } from '../../test/console-flows.js';
import { createHarness, type Harness, type TestBrowser } from '../../test/harness.js';

let h: Harness;
let b: BookableBusiness;

beforeAll(async () => {
  h = await createHarness();
});
afterAll(async () => {
  await h.close();
});
beforeEach(async () => {
  await h.reset();
  b = await bookableBusiness(h);
});

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 1, 2]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1]);

const photoOf = async (browser: TestBrowser, id: string) =>
  (await browser.get(`${C}/members/${id}`)).json<{ photoUrl: string | null }>().photoUrl;

const requestUpload = (browser: TestBrowser, id: string, sizeBytes = PNG.length) =>
  browser.post(`${C}/members/${id}/photo/upload-url`, { contentType: 'image/png', sizeBytes });

/** Signs, "uploads" the bytes like the browser would, and confirms. */
async function upload(browser: TestBrowser, id: string, bytes = PNG, contentType = 'image/png') {
  const signed = await browser.post(`${C}/members/${id}/photo/upload-url`, {
    contentType,
    sizeBytes: bytes.length,
  });
  expect(signed.statusCode, signed.body).toBe(200);
  const { key } = signed.json<{ key: string }>();
  h.storage.put(key, bytes);
  const confirm = await browser.request('PUT', `${C}/members/${id}/photo`, { key });
  return { key, confirm };
}

describe('therapist photos (FSD 6.15)', () => {
  it('a therapist adds their own photo; customers see it on the branch and their booking', async () => {
    const { key, confirm } = await upload(b.staff, b.staffId);
    expect(confirm.statusCode, confirm.body).toBe(200);
    expect(key).toMatch(/^tenants\/[0-9a-f-]{36}\/staff\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.png$/);
    const url = `http://files.test/${key}`;
    expect(confirm.json<{ photoUrl: string }>().photoUrl).toBe(url);
    expect(await photoOf(b.owner, b.staffId)).toBe(url);

    const branch = (
      await portalBrowser(h).get(`/v1/public/tenants/${b.slug}/branches/${b.branchId}`)
    ).json<{ therapists: { id: string; photoUrl: string | null }[] }>();
    expect(branch.therapists.find((t) => t.id === b.staffId)?.photoUrl).toBe(url);

    const booked = await expectBooked(
      portalBrowser(h),
      bookingBody(b, nyTime(nextWeekday(1), '10:00')),
    );
    expect(booked.booking).toMatchObject({ therapistPhotoUrl: url });

    const entry = await h.owner.auditLog.findFirst({
      where: { action: 'membership.photo_changed' },
    });
    expect(entry).toMatchObject({
      entityId: b.staffId,
      branchId: b.branchId,
      after: { photo: key },
    });
  });

  it('replacing a photo deletes the old file; removing it clears the URL', async () => {
    const first = await upload(b.owner, b.staffId);
    const second = await upload(b.owner, b.staffId, JPEG, 'image/jpeg');
    expect(second.confirm.statusCode).toBe(200);
    expect(h.storage.has(first.key)).toBe(false);

    const removed = await b.owner.request('DELETE', `${C}/members/${b.staffId}/photo`);
    expect(removed.statusCode, removed.body).toBe(200);
    expect(removed.json<{ photoUrl: string | null }>().photoUrl).toBeNull();
    expect(h.storage.has(second.key)).toBe(false);
  });

  it('only the owner, the branch manager and the therapist; keys stay with their therapist', async () => {
    const { browser: colleague, membershipId: colleagueId } = await consoleFlows(h).addMember(
      b.owner,
      PEOPLE.daniel,
      'staff',
      b.branchId,
    );
    // Another therapist's photo is out of a staff member's scope: it does not exist for them.
    expect((await requestUpload(colleague, b.staffId)).statusCode).toBe(404);

    // A key signed for one therapist cannot be confirmed for another.
    const signed = await requestUpload(b.staff, b.staffId);
    const { key } = signed.json<{ key: string }>();
    h.storage.put(key, PNG);
    const moved = await colleague.request('PUT', `${C}/members/${colleagueId}/photo`, { key });
    expect(moved.json<{ code: string }>().code).toBe('UPLOAD_MISSING');

    // The owner has no branch, so no therapist profile and no photo.
    const me = (await b.owner.get(`${C}/me`)).json<{ activeMembership: { id: string } }>();
    expect((await requestUpload(b.owner, me.activeMembership.id)).statusCode).toBe(409);

    // Same size limit as a logo.
    const tooBig = await requestUpload(b.staff, b.staffId, 1024 * 1024 + 1);
    expect(tooBig.statusCode).toBe(400);
  });
});
