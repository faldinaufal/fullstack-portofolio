// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { consoleFlows, OWNER } from '../../test/console-flows.js';
import { createHarness, TestBrowser, type Harness } from '../../test/harness.js';
import { PORTAL_COOKIES } from './routes.js';
import { PORTAL_AUTH_POLICY } from './service.js';

let h: Harness;
beforeAll(async () => {
  h = await createHarness();
});
afterAll(async () => {
  await h.close();
});
beforeEach(async () => {
  await h.reset();
});

const PT = '/v1/portal';
const INES = {
  name: 'Ines Halvorsen',
  email: 'ines.halvorsen@veloria.test',
  password: 'quiet river at dawn 4217',
  phone: '+15550147001',
};
const customer = () => new TestBrowser(h.app, `${PT}/auth/csrf`);

async function signUp() {
  const browser = customer();
  const response = await browser.post(`${PT}/auth/signup`, INES);
  expect(response.statusCode).toBe(201);
  return browser;
}

async function tokenFrom(template: 'portal.verify_email' | 'portal.password_reset') {
  const payload = await h.lastEmail(INES.email, template);
  const url = payload && ('verifyUrl' in payload ? payload.verifyUrl : payload.resetUrl);
  if (!url) throw new Error(`No ${template} email`);
  return new URL(url).searchParams.get('token')!;
}

describe('sign-up and email verification', () => {
  it('creates the account, logs in and sends a verification link that works once', async () => {
    const browser = await signUp();
    expect(browser.cookies.has(PORTAL_COOKIES.session)).toBe(true);
    expect((await browser.get(`${PT}/me`)).json()).toMatchObject({
      email: INES.email,
      phone: INES.phone,
      emailVerified: false,
    });

    const token = await tokenFrom('portal.verify_email');
    const verified = await customer().post(`${PT}/auth/verify-email`, { token });
    expect(verified.json()).toMatchObject({ emailVerified: true });
    const again = await customer().post(`${PT}/auth/verify-email`, { token });
    expect(again.json()).toMatchObject({ code: 'TOKEN_INVALID' });
  });

  it('rejects a taken email and a password that contains the email', async () => {
    await signUp();
    expect((await customer().post(`${PT}/auth/signup`, INES)).json()).toMatchObject({
      code: 'EMAIL_TAKEN',
    });
    const weak = await customer().post(`${PT}/auth/signup`, {
      ...INES,
      email: 'omar@veloria.test',
      password: 'omar likes long walks',
    });
    expect(weak.json()).toMatchObject({ code: 'VALIDATION_FAILED' });
  });
});

describe('login', () => {
  it('needs no second factor and answers the same for unknown emails and wrong passwords', async () => {
    await signUp();
    const ok = await customer().post(`${PT}/auth/login`, {
      email: INES.email,
      password: INES.password,
    });
    expect(ok.statusCode).toBe(200);

    const wrong = await customer().post(`${PT}/auth/login`, {
      email: INES.email,
      password: 'not it at all',
    });
    const unknown = await customer().post(`${PT}/auth/login`, {
      email: 'nobody@veloria.test',
      password: 'not it at all',
    });
    const strip = ({ requestId: _r, ...rest }: Record<string, unknown>) => rest;
    expect(strip(wrong.json())).toEqual(strip(unknown.json()));
  });

  it('locks the email + IP after 5 failures', async () => {
    await signUp();
    const browser = customer();
    for (let i = 0; i < 5; i += 1) {
      await browser.post(`${PT}/auth/login`, { email: INES.email, password: 'wrong password!!' });
    }
    const locked = await browser.post(`${PT}/auth/login`, {
      email: INES.email,
      password: INES.password,
    });
    expect(locked.statusCode).toBe(429);
  });

  it('requires the Portal CSRF token', async () => {
    const response = await customer().post(`${PT}/auth/login`, INES, { csrf: false });
    expect(response.json()).toMatchObject({ code: 'CSRF_INVALID' });
  });
});

describe('separation from the Console (PRD: separate accounts)', () => {
  it('keeps customer and team accounts apart, even with the same email', async () => {
    const shopper = await signUp();
    const flows = consoleFlows(h);
    const owner = await flows.signUp({ ...OWNER, email: INES.email });

    // Each app's cookie only works on its own routes.
    expect((await shopper.get('/v1/console/me')).statusCode).toBe(401);
    expect((await owner.get(`${PT}/me`)).statusCode).toBe(401);
    expect(await h.owner.customerAccount.count()).toBe(1);
    expect(await h.owner.teamAccount.count()).toBe(1);
  });

  it('rejects a Console session token smuggled into the Portal cookie', async () => {
    const owner = await consoleFlows(h).signUp();
    const consoleToken = owner.cookies.get('tempora_console_session')!;
    const smuggled = await h.app.inject({
      method: 'GET',
      url: `${PT}/me`,
      headers: { cookie: `${PORTAL_COOKIES.session}=${consoleToken}` },
    });
    expect(smuggled.statusCode).toBe(401);
  });

  it('rejects a Portal session token smuggled into the Console cookie', async () => {
    const shopper = await signUp();
    const portalToken = shopper.cookies.get(PORTAL_COOKIES.session)!;
    const smuggled = await h.app.inject({
      method: 'GET',
      url: '/v1/console/me',
      headers: { cookie: `tempora_console_session=${portalToken}` },
    });
    expect(smuggled.statusCode).toBe(401);
  });
});

describe('sessions', () => {
  it('last 30 days and are renewed by activity', async () => {
    const browser = await signUp();
    h.clock.advance(PORTAL_AUTH_POLICY.sessionLifetimeMs - 60_000);
    expect((await browser.get(`${PT}/me`)).statusCode).toBe(200); // activity renews

    h.clock.advance(PORTAL_AUTH_POLICY.sessionLifetimeMs - 60_000);
    expect((await browser.get(`${PT}/me`)).statusCode).toBe(200); // still renewed

    h.clock.advance(PORTAL_AUTH_POLICY.sessionLifetimeMs + 60_000);
    expect((await browser.get(`${PT}/me`)).statusCode).toBe(401); // idle too long
  });

  it('lists sessions, revokes one or all, and never someone else’s', async () => {
    const laptop = await signUp();
    const phone = customer();
    await phone.post(`${PT}/auth/login`, { email: INES.email, password: INES.password });

    const list = (await laptop.get(`${PT}/me/sessions`)).json<{
      items: { id: string; current: boolean }[];
    }>();
    expect(list.items).toHaveLength(2);
    const phoneSession = list.items.find((s) => !s.current)!;

    const other = customer();
    await other.post(`${PT}/auth/signup`, {
      ...INES,
      email: 'omar@veloria.test',
      password: 'harbor clinic passphrase',
    });
    expect((await other.request('DELETE', `${PT}/me/sessions/${phoneSession.id}`)).statusCode).toBe(
      404,
    );

    expect(
      (await laptop.request('DELETE', `${PT}/me/sessions/${phoneSession.id}`)).statusCode,
    ).toBe(204);
    expect((await phone.get(`${PT}/me`)).statusCode).toBe(401);

    expect((await laptop.post(`${PT}/auth/logout-all`)).statusCode).toBe(204);
    expect((await laptop.get(`${PT}/me`)).statusCode).toBe(401);
  });
});

describe('password', () => {
  it('reset by email ends every session; unknown emails get nothing', async () => {
    const browser = await signUp();
    await customer().post(`${PT}/auth/forgot-password`, { email: 'nobody@veloria.test' });
    expect(await h.owner.emailMessage.count({ where: { template: 'portal.password_reset' } })).toBe(
      0,
    );

    await customer().post(`${PT}/auth/forgot-password`, { email: INES.email });
    const token = await tokenFrom('portal.password_reset');
    const reset = await customer().post(`${PT}/auth/reset-password`, {
      token,
      password: 'a brand new passphrase',
    });
    expect(reset.statusCode).toBe(200);
    expect((await browser.get(`${PT}/me`)).statusCode).toBe(401);
    expect(await h.lastEmail(INES.email, 'portal.password_changed')).toBeDefined();
  });

  it('change needs the current password and keeps only this session', async () => {
    const laptop = await signUp();
    const phone = customer();
    await phone.post(`${PT}/auth/login`, { email: INES.email, password: INES.password });

    const wrong = await laptop.post(`${PT}/me/password`, {
      currentPassword: 'not my password',
      newPassword: 'a brand new passphrase',
    });
    expect(wrong.json()).toMatchObject({
      code: 'VALIDATION_FAILED',
      errors: [{ path: 'currentPassword' }],
    });

    const changed = await laptop.post(`${PT}/me/password`, {
      currentPassword: INES.password,
      newPassword: 'a brand new passphrase',
    });
    expect(changed.statusCode).toBe(204);
    expect((await laptop.get(`${PT}/me`)).statusCode).toBe(200);
    expect((await phone.get(`${PT}/me`)).statusCode).toBe(401);
  });
});

it('updates name and phone', async () => {
  const browser = await signUp();
  const updated = await browser.request('PATCH', `${PT}/me`, {
    name: 'Ines H. Halvorsen',
    phone: null,
  });
  expect(updated.json()).toMatchObject({ name: 'Ines H. Halvorsen', phone: null });
  expect((await browser.request('PATCH', `${PT}/me`, { phone: '555-0147' })).statusCode).toBe(400);
});
