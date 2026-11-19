// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { expect } from 'vitest';
import { createArgon2PasswordHasher } from '../lib/passwords.js';
import { createPlatformAdmin } from '../modules/admin-auth/create-admin.js';
import { TestBrowser, type Harness } from './harness.js';

export const A = '/v1/admin';

export const ADMIN = {
  name: 'Ines Halvorsen',
  email: 'ops@veloria.test',
  password: 'lantern harbor quiet 4217',
};

export const adminBrowser = (h: Harness) => new TestBrowser(h.app, `${A}/auth/csrf`);

export function adminFlows(h: Harness) {
  async function create(input = ADMIN) {
    const result = await createPlatformAdmin(h.prisma, createArgon2PasswordHasher(), input);
    expect(result.ok).toBe(true);
  }

  async function codeFor(email: string) {
    const payload = await h.lastEmail(email, 'admin.login_code');
    if (!payload) throw new Error(`No admin code emailed to ${email}`);
    return payload.code;
  }

  /** Logs in with the emailed code; the session starts with a fresh step-up. */
  async function login(input = ADMIN) {
    const browser = adminBrowser(h);
    const challenge = await browser.post(`${A}/auth/login`, {
      email: input.email,
      password: input.password,
    });
    expect(challenge.statusCode, challenge.body).toBe(200);
    const verified = await browser.post(`${A}/auth/verify-otp`, {
      challengeId: challenge.json<{ challengeId: string }>().challengeId,
      code: await codeFor(input.email),
    });
    expect(verified.statusCode, verified.body).toBe(204);
    return browser;
  }

  /** Re-verifies a session with a new emailed code (FSD 6.11 step-up). */
  async function stepUp(browser: TestBrowser, email = ADMIN.email) {
    const started = await browser.post(`${A}/auth/step-up`);
    expect(started.statusCode, started.body).toBe(200);
    const verified = await browser.post(`${A}/auth/step-up/verify`, {
      challengeId: started.json<{ challengeId: string }>().challengeId,
      code: await codeFor(email),
    });
    expect(verified.statusCode, verified.body).toBe(200);
  }

  return { create, codeFor, login, stepUp };
}
