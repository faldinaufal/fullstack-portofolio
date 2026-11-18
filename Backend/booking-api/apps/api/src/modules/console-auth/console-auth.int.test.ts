// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { withDbContext } from '@tempora/db';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createHarness, TestBrowser, type Harness } from '../../test/harness.js';
import { CONSOLE_COOKIES } from './cookies.js';
import { CONSOLE_AUTH_POLICY as POLICY } from './policy.js';

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

const OWNER = {
  name: 'Maya Reyes',
  email: 'maya@veloria.test',
  password: 'correct horse battery',
  businessName: 'Lumen Wellness Studio',
  slug: 'lumen',
};

const browser = () => new TestBrowser(h.app);

async function codeFor(email: string) {
  const payload = await h.lastEmail(email, 'console.login_code');
  if (!payload) throw new Error(`No login code emailed to ${email}`);
  return payload.code;
}

/** Signs up and completes the code step; returns the logged-in browser. */
async function signUp(input = OWNER, options: { trustDevice?: boolean } = {}) {
  const user = browser();
  const signup = await user.post('/v1/console/auth/signup', input);
  expect(signup.statusCode).toBe(201);
  const { challengeId } = signup.json<{ challengeId: string }>();
  const verify = await user.post('/v1/console/auth/verify-otp', {
    challengeId,
    code: await codeFor(input.email),
    trustDevice: options.trustDevice ?? false,
  });
  expect(verify.statusCode).toBe(200);
  return user;
}

async function login(user: TestBrowser, email = OWNER.email, password = OWNER.password) {
  return user.post('/v1/console/auth/login', { email, password });
}

describe('sign-up', () => {
  it('creates account, business and owner membership, and logs in after the email code', async () => {
    const user = browser();
    const signup = await user.post('/v1/console/auth/signup', OWNER);

    expect(signup.statusCode).toBe(201);
    expect(signup.json()).toMatchObject({ status: 'otp_required', sentTo: 'm***@veloria.test' });
    expect(user.cookies.has(CONSOLE_COOKIES.session)).toBe(false); // no session before the code

    const { challengeId } = signup.json<{ challengeId: string }>();
    const verify = await user.post('/v1/console/auth/verify-otp', {
      challengeId,
      code: await codeFor(OWNER.email),
    });
    expect(verify.statusCode).toBe(200);
    expect(user.cookies.has(CONSOLE_COOKIES.session)).toBe(true);

    const me = await user.get('/v1/console/me');
    expect(me.statusCode).toBe(200);
    expect(me.json()).toMatchObject({
      account: { email: OWNER.email, name: OWNER.name },
      activeMembership: {
        role: 'owner',
        branchId: null,
        tenant: { slug: 'lumen', name: OWNER.businessName },
      },
    });

    const account = await h.owner.teamAccount.findUniqueOrThrow({ where: { email: OWNER.email } });
    expect(account.emailVerifiedAt).not.toBeNull(); // the code proved the address
    expect(account.passwordHash).toMatch(/^\$argon2id\$/);
  });

  it('rejects a taken email or slug, and a password containing the email', async () => {
    await signUp();

    const sameEmail = await browser().post('/v1/console/auth/signup', { ...OWNER, slug: 'other' });
    expect(sameEmail.statusCode).toBe(409);
    expect(sameEmail.json()).toMatchObject({ code: 'EMAIL_TAKEN' });

    const sameSlug = await browser().post('/v1/console/auth/signup', {
      ...OWNER,
      email: 'ines.halvorsen@veloria.test',
    });
    expect(sameSlug.statusCode).toBe(409);
    expect(sameSlug.json()).toMatchObject({ code: 'SLUG_TAKEN' });

    const weak = await browser().post('/v1/console/auth/signup', {
      ...OWNER,
      email: 'daniel@veloria.test',
      slug: 'harbor',
      password: 'daniel-is-my-password',
    });
    expect(weak.statusCode).toBe(400);
    expect(weak.json()).toMatchObject({
      code: 'VALIDATION_FAILED',
      errors: [{ path: 'password' }],
    });
  });
});

describe('CSRF', () => {
  it('rejects state-changing requests without the token', async () => {
    const response = await browser().post(
      '/v1/console/auth/login',
      { email: OWNER.email, password: OWNER.password },
      { csrf: false },
    );
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ code: 'CSRF_INVALID' });
  });
});

describe('login', () => {
  it('gives the same answer for an unknown email and a wrong password', async () => {
    await signUp();

    const wrongPassword = await login(browser(), OWNER.email, 'not the password at all');
    const unknownEmail = await login(browser(), 'nobody@veloria.test', 'not the password at all');

    expect(wrongPassword.statusCode).toBe(401);
    expect(unknownEmail.statusCode).toBe(401);
    const strip = ({ requestId: _id, ...rest }: Record<string, unknown>) => rest;
    expect(strip(wrongPassword.json())).toEqual(strip(unknownEmail.json()));
  });

  it('locks the email + IP after 5 failed attempts for 15 minutes', async () => {
    await signUp();
    const user = browser();
    for (let i = 0; i < 5; i += 1) {
      expect((await login(user, OWNER.email, 'wrong password!!')).statusCode).toBe(401);
    }
    const locked = await login(user); // even the right password is refused while locked
    expect(locked.statusCode).toBe(429);
    expect(locked.json()).toMatchObject({ code: 'RATE_LIMITED' });

    h.clock.advance(15 * 60_000 + 1_000);
    expect((await login(user)).statusCode).toBe(200);
  });

  it('asks for a code and creates no session until it is entered', async () => {
    await signUp();
    const user = browser();
    const response = await login(user);

    expect(response.json()).toMatchObject({ status: 'otp_required' });
    expect(user.cookies.has(CONSOLE_COOKIES.session)).toBe(false);
    expect((await user.get('/v1/console/me')).statusCode).toBe(401);
  });
});

describe('email code', () => {
  async function startLogin() {
    await signUp();
    const user = browser();
    const { challengeId } = (await login(user)).json<{ challengeId: string }>();
    return { user, challengeId };
  }

  it('allows 5 wrong attempts, then requires a new login', async () => {
    const { user, challengeId } = await startLogin();
    const code = await codeFor(OWNER.email);
    const wrong = code === '000000' ? '111111' : '000000';

    for (let left = 4; left >= 1; left -= 1) {
      const response = await user.post('/v1/console/auth/verify-otp', { challengeId, code: wrong });
      expect(response.statusCode).toBe(401);
      expect(response.json()).toMatchObject({ code: 'CODE_INVALID' });
      expect(response.json<{ detail: string }>().detail).toContain(`${left} attempt`);
    }
    const fifth = await user.post('/v1/console/auth/verify-otp', { challengeId, code: wrong });
    expect(fifth.json()).toMatchObject({ code: 'CODE_EXPIRED' });

    const correctTooLate = await user.post('/v1/console/auth/verify-otp', { challengeId, code });
    expect(correctTooLate.statusCode).toBe(410);
  });

  it('expires after 10 minutes and cannot be used twice', async () => {
    const { user, challengeId } = await startLogin();
    const code = await codeFor(OWNER.email);

    h.clock.advance(POLICY.otpTtlMs + 1_000);
    const expired = await user.post('/v1/console/auth/verify-otp', { challengeId, code });
    expect(expired.json()).toMatchObject({ code: 'CODE_EXPIRED' });

    h.clock.reset();
    const again = await login(user);
    const second = again.json<{ challengeId: string }>();
    const secondCode = await codeFor(OWNER.email);
    const first = await user.post('/v1/console/auth/verify-otp', {
      challengeId: second.challengeId,
      code: secondCode,
    });
    expect(first.statusCode).toBe(200);
    const reused = await browser().post('/v1/console/auth/verify-otp', {
      challengeId: second.challengeId,
      code: secondCode,
    });
    expect(reused.json()).toMatchObject({ code: 'CODE_EXPIRED' });
  });

  it('resends at most once a minute and invalidates the previous code', async () => {
    const { user, challengeId } = await startLogin();
    const oldCode = await codeFor(OWNER.email);

    const tooSoon = await user.post('/v1/console/auth/resend-otp', { challengeId });
    expect(tooSoon.statusCode).toBe(429);

    h.clock.advance(POLICY.otpResendCooldownMs + 1_000);
    const resent = await user.post('/v1/console/auth/resend-otp', { challengeId });
    expect(resent.statusCode).toBe(200);
    const newCode = await codeFor(OWNER.email);

    if (newCode !== oldCode) {
      const old = await user.post('/v1/console/auth/verify-otp', { challengeId, code: oldCode });
      expect(old.json()).toMatchObject({ code: 'CODE_INVALID' });
    }
    const ok = await user.post('/v1/console/auth/verify-otp', { challengeId, code: newCode });
    expect(ok.statusCode).toBe(200);
  });
});

describe('trusted device', () => {
  it('skips the code on that browser only, until the password changes', async () => {
    const trusted = await signUp(OWNER, { trustDevice: true });
    expect(trusted.cookies.has(CONSOLE_COOKIES.trustedDevice)).toBe(true);
    await trusted.post('/v1/console/auth/logout');

    const again = await login(trusted);
    expect(again.json()).toEqual({ status: 'authenticated' });
    expect((await trusted.get('/v1/console/me')).statusCode).toBe(200);

    const otherBrowser = await login(browser());
    expect(otherBrowser.json()).toMatchObject({ status: 'otp_required' });

    // A password reset revokes trusted devices: the code is required again.
    await browser().post('/v1/console/auth/forgot-password', { email: OWNER.email });
    const { resetUrl } = (await h.lastEmail(OWNER.email, 'console.password_reset'))!;
    const token = new URL(resetUrl).searchParams.get('token')!;
    const newPassword = 'a brand new passphrase';
    await browser().post('/v1/console/auth/reset-password', { token, password: newPassword });

    const afterReset = await login(trusted, OWNER.email, newPassword);
    expect(afterReset.json()).toMatchObject({ status: 'otp_required' });
  });
});

describe('sessions', () => {
  it('end after 12 hours without activity', async () => {
    const user = await signUp();
    h.clock.advance(POLICY.sessionIdleMs - 60_000);
    expect((await user.get('/v1/console/me')).statusCode).toBe(200); // activity renews

    h.clock.advance(POLICY.sessionIdleMs + 60_000);
    expect((await user.get('/v1/console/me')).statusCode).toBe(401);
  });

  it('logout ends this session; logout-all ends every session', async () => {
    const first = await signUp();
    const second = browser();
    const { challengeId } = (await login(second)).json<{ challengeId: string }>();
    await second.post('/v1/console/auth/verify-otp', {
      challengeId,
      code: await codeFor(OWNER.email),
    });

    expect((await first.post('/v1/console/auth/logout')).statusCode).toBe(204);
    expect((await first.get('/v1/console/me')).statusCode).toBe(401);
    expect((await second.get('/v1/console/me')).statusCode).toBe(200);

    const third = browser();
    const next = (await login(third)).json<{ challengeId: string }>();
    await third.post('/v1/console/auth/verify-otp', {
      challengeId: next.challengeId,
      code: await codeFor(OWNER.email),
    });
    expect((await third.post('/v1/console/auth/logout-all')).statusCode).toBe(204);
    expect((await second.get('/v1/console/me')).statusCode).toBe(401);
  });

  it('end immediately when the membership is deactivated', async () => {
    const user = await signUp();
    await h.owner.membership.updateMany({ data: { status: 'deactivated' } });
    expect((await user.get('/v1/console/me')).statusCode).toBe(401);
  });
});

describe('password reset', () => {
  it('answers the same for unknown emails and sends nothing', async () => {
    const response = await browser().post('/v1/console/auth/forgot-password', {
      email: 'nobody@veloria.test',
    });
    expect(response.statusCode).toBe(202);
    expect(await h.owner.emailMessage.count()).toBe(0);
  });

  it('sets a new password once, ends every session and emails a notice', async () => {
    const user = await signUp();
    await browser().post('/v1/console/auth/forgot-password', { email: OWNER.email });
    const email = await h.lastEmail(OWNER.email, 'console.password_reset');
    const token = new URL(email!.resetUrl).searchParams.get('token')!;

    const newPassword = 'another long passphrase';
    const reset = await browser().post('/v1/console/auth/reset-password', {
      token,
      password: newPassword,
    });
    expect(reset.statusCode).toBe(200);
    expect((await user.get('/v1/console/me')).statusCode).toBe(401);
    expect(await h.lastEmail(OWNER.email, 'console.password_changed')).toBeDefined();

    const reused = await browser().post('/v1/console/auth/reset-password', {
      token,
      password: 'yet another passphrase',
    });
    expect(reused.json()).toMatchObject({ code: 'TOKEN_INVALID' });

    expect((await login(browser(), OWNER.email, OWNER.password)).statusCode).toBe(401);
    expect((await login(browser(), OWNER.email, newPassword)).json()).toMatchObject({
      status: 'otp_required',
    });
  });

  it('rejects an expired link', async () => {
    await signUp();
    await browser().post('/v1/console/auth/forgot-password', { email: OWNER.email });
    const email = await h.lastEmail(OWNER.email, 'console.password_reset');
    const token = new URL(email!.resetUrl).searchParams.get('token')!;

    h.clock.advance(POLICY.passwordResetTtlMs + 1_000);
    const response = await browser().post('/v1/console/auth/reset-password', {
      token,
      password: 'another long passphrase',
    });
    expect(response.json()).toMatchObject({ code: 'TOKEN_INVALID' });
  });
});

describe('tenant isolation (RLS, FSD 9.2)', () => {
  it('returns no rows of another tenant, and none at all without a context', async () => {
    await signUp();
    await signUp({
      name: 'Daniel Kim',
      email: 'daniel@veloria.test',
      password: 'harbor clinic passphrase',
      businessName: 'Harbor Physio Clinic',
      slug: 'harbor',
    });
    const [lumen, harbor] = await Promise.all([
      h.owner.tenant.findUniqueOrThrow({ where: { slug: 'lumen' } }),
      h.owner.tenant.findUniqueOrThrow({ where: { slug: 'harbor' } }),
    ]);

    // No tenant filter in these queries: only the database policies decide.
    const asLumen = await withDbContext(h.prisma, { tenantId: lumen.id }, (tx) =>
      tx.membership.findMany(),
    );
    expect(asLumen.map((m) => m.tenantId)).toEqual([lumen.id]);

    const noContext = await withDbContext(h.prisma, {}, (tx) => tx.membership.findMany());
    expect(noContext).toEqual([]);

    const crossInsert = withDbContext(h.prisma, { tenantId: lumen.id }, (tx) =>
      tx.branch.create({ data: { tenantId: harbor.id, name: 'Sneaky branch' } }),
    );
    await expect(crossInsert).rejects.toThrow();
  });

  it('keeps exactly one active owner per tenant', async () => {
    await signUp();
    const tenant = await h.owner.tenant.findUniqueOrThrow({ where: { slug: 'lumen' } });
    const other = await h.owner.teamAccount.create({
      data: { email: 'ines.halvorsen@veloria.test', name: 'Ines Halvorsen', passwordHash: 'x' },
    });
    const secondOwner = h.owner.membership.create({
      data: { tenantId: tenant.id, teamAccountId: other.id, role: 'owner' },
    });
    await expect(secondOwner).rejects.toThrow();
  });
});
