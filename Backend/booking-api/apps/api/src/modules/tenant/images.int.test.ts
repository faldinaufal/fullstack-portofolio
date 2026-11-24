// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  bookableBusiness,
  portalBrowser,
  SECOND_OWNER,
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
/** An HTML page renamed to .png: the declared type is a lie. */
const HTML = new TextEncoder().encode('<html><script>alert(1)</script></html>');

interface Settings {
  version: number;
  logoUrl: string | null;
  coverUrl: string | null;
}

const settings = async (owner: TestBrowser) => (await owner.get(`${C}/tenant`)).json<Settings>();

async function requestUpload(
  owner: TestBrowser,
  image: 'logo' | 'cover',
  contentType: string,
  sizeBytes: number,
) {
  return owner.post(`${C}/tenant/${image}/upload-url`, { contentType, sizeBytes });
}

/** Signs, "uploads" the bytes like the browser would, and confirms. */
async function upload(
  owner: TestBrowser,
  image: 'logo' | 'cover',
  bytes: Uint8Array,
  contentType = 'image/png',
) {
  const signed = await requestUpload(owner, image, contentType, bytes.length);
  expect(signed.statusCode, signed.body).toBe(200);
  const { key, headers } = signed.json<{ key: string; headers: Record<string, string> }>();
  expect(headers['Content-Type']).toBe(contentType);
  h.storage.put(key, bytes);
  const { version } = await settings(owner);
  const confirm = await owner.request(
    'PUT',
    `${C}/tenant/${image}`,
    { key },
    {
      'if-match': String(version),
    },
  );
  return { key, confirm };
}

describe('business images (FSD 6.15)', () => {
  it('a confirmed logo and cover appear in the Console and on the public pages', async () => {
    const logo = await upload(b.owner, 'logo', PNG);
    expect(logo.confirm.statusCode, logo.confirm.body).toBe(200);
    expect(logo.key).toMatch(/^tenants\/[0-9a-f-]{36}\/logo\/[0-9a-f-]{36}\.png$/);
    const cover = await upload(b.owner, 'cover', JPEG, 'image/jpeg');
    expect(cover.confirm.statusCode, cover.confirm.body).toBe(200);

    const mine = await settings(b.owner);
    expect(mine.logoUrl).toBe(`http://files.test/${logo.key}`);
    expect(mine.coverUrl).toBe(`http://files.test/${cover.key}`);

    const visitor = portalBrowser(h);
    const page = (await visitor.get(`/v1/public/tenants/${b.slug}`)).json<Settings>();
    expect(page).toMatchObject({ logoUrl: mine.logoUrl, coverUrl: mine.coverUrl });
    const directory = (await visitor.get('/v1/public/tenants')).json<{
      items: { slug: string; logoUrl: string | null }[];
    }>();
    expect(directory.items.find((t) => t.slug === b.slug)?.logoUrl).toBe(mine.logoUrl);

    const entries = await h.owner.auditLog.findMany({
      where: { action: 'tenant.updated' },
      orderBy: { createdAt: 'asc' },
    });
    expect(entries.map((e) => e.after)).toEqual([{ logo: logo.key }, { cover: cover.key }]);
  });

  it('replacing an image deletes the old file; removing it clears the URL', async () => {
    const first = await upload(b.owner, 'logo', PNG);
    const second = await upload(b.owner, 'logo', JPEG, 'image/jpeg');
    expect(second.confirm.statusCode).toBe(200);
    expect(h.storage.has(first.key)).toBe(false);
    expect(h.storage.has(second.key)).toBe(true);

    const { version } = await settings(b.owner);
    const removed = await b.owner.request('DELETE', `${C}/tenant/logo`, undefined, {
      'if-match': String(version),
    });
    expect(removed.statusCode, removed.body).toBe(200);
    expect(removed.json<Settings>().logoUrl).toBeNull();
    expect(h.storage.has(second.key)).toBe(false);
  });

  it('checks the real type of the stored file, not the declared one', async () => {
    const { key, confirm } = await upload(b.owner, 'logo', HTML);
    expect(confirm.statusCode).toBe(422);
    expect(confirm.json<{ code: string }>().code).toBe('UPLOAD_INVALID');
    expect(h.storage.has(key)).toBe(false);
    expect((await settings(b.owner)).logoUrl).toBeNull();
  });

  it('refuses files above the limit, before and after the upload', async () => {
    const tooBig = await requestUpload(b.owner, 'logo', 'image/png', 1024 * 1024 + 1);
    expect(tooBig.statusCode).toBe(400);
    expect(tooBig.json<{ errors: { path: string }[] }>().errors[0]?.path).toBe('sizeBytes');
    // A cover may be larger than a logo.
    expect((await requestUpload(b.owner, 'cover', 'image/jpeg', 3 * 1024 * 1024)).statusCode).toBe(
      200,
    );

    // The browser declared 14 bytes but stored more: caught on confirm.
    const signed = await requestUpload(b.owner, 'logo', 'image/png', PNG.length);
    const { key } = signed.json<{ key: string }>();
    const big = new Uint8Array(1024 * 1024 + 10);
    big.set(PNG);
    h.storage.put(key, big);
    const { version } = await settings(b.owner);
    const confirm = await b.owner.request(
      'PUT',
      `${C}/tenant/logo`,
      { key },
      {
        'if-match': String(version),
      },
    );
    expect(confirm.json<{ code: string }>().code).toBe('UPLOAD_INVALID');
  });

  it('rejects SVG, missing uploads and keys of another business or image kind', async () => {
    expect((await requestUpload(b.owner, 'logo', 'image/svg+xml', 200)).statusCode).toBe(400);

    const signed = await requestUpload(b.owner, 'logo', 'image/png', PNG.length);
    const { key } = signed.json<{ key: string }>();
    const { version } = await settings(b.owner);
    const confirm = (image: string, k: string, owner = b.owner, v = version) =>
      owner.request('PUT', `${C}/tenant/${image}`, { key: k }, { 'if-match': String(v) });

    // Signed but never uploaded.
    expect((await confirm('logo', key)).json<{ code: string }>().code).toBe('UPLOAD_MISSING');
    h.storage.put(key, PNG);
    // A logo key cannot become the cover.
    expect((await confirm('cover', key)).json<{ code: string }>().code).toBe('UPLOAD_MISSING');

    // Another business cannot claim this business's file.
    const other = await consoleFlows(h).signUp(SECOND_OWNER);
    const otherVersion = (await settings(other)).version;
    const stolen = await confirm('logo', key, other, otherVersion);
    expect(stolen.json<{ code: string }>().code).toBe('UPLOAD_MISSING');
    expect((await settings(other)).logoUrl).toBeNull();
  });

  it('uses optimistic locking and is for owners only', async () => {
    const signed = await requestUpload(b.owner, 'logo', 'image/png', PNG.length);
    const { key } = signed.json<{ key: string }>();
    h.storage.put(key, PNG);
    const { version } = await settings(b.owner);
    const stale = await b.owner.request(
      'PUT',
      `${C}/tenant/logo`,
      { key },
      {
        'if-match': String(version - 1 || 99),
      },
    );
    expect(stale.statusCode).toBe(409);

    const { browser: manager } = await consoleFlows(h).addMember(
      b.owner,
      PEOPLE.daniel,
      'manager',
      b.branchId,
    );
    expect((await requestUpload(manager, 'logo', 'image/png', 10)).statusCode).toBe(403);
    expect((await requestUpload(b.staff, 'logo', 'image/png', 10)).statusCode).toBe(403);
  });
});
