// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { expect } from 'vitest';
import { TestBrowser, type Harness } from './harness.js';

/** Common Console journeys for integration tests: sign up, log in, add branches and members. */

export const C = '/v1/console';

export const OWNER = {
  name: 'Maya Reyes',
  email: 'maya@veloria.test',
  password: 'correct horse battery',
  businessName: 'Lumen Wellness Studio',
  slug: 'lumen',
};

/** Must not contain the member's email (FSD 6.11), so it is not derived from their name. */
export const MEMBER_PASSWORD = 'quiet river at dawn 4217';

export const PEOPLE = {
  daniel: { name: 'Daniel Kim', email: 'daniel@veloria.test' },
  ines: { name: 'Ines Halvorsen', email: 'ines.halvorsen@veloria.test' },
  omar: { name: 'Omar Haddad', email: 'omar@veloria.test' },
};

export function consoleFlows(h: Harness) {
  async function codeFor(email: string) {
    const payload = await h.lastEmail(email, 'console.login_code');
    if (!payload) throw new Error(`No login code emailed to ${email}`);
    return payload.code;
  }

  async function verify(user: TestBrowser, challengeId: string, email: string) {
    const response = await user.post(`${C}/auth/verify-otp`, {
      challengeId,
      code: await codeFor(email),
    });
    expect(response.statusCode).toBe(200);
    return user;
  }

  async function signUp(input = OWNER) {
    const user = new TestBrowser(h.app);
    const signup = await user.post(`${C}/auth/signup`, input);
    expect(signup.statusCode).toBe(201);
    return verify(user, signup.json<{ challengeId: string }>().challengeId, input.email);
  }

  async function login(email: string, password: string) {
    const user = new TestBrowser(h.app);
    const response = await user.post(`${C}/auth/login`, { email, password });
    expect(response.statusCode).toBe(200);
    return verify(user, response.json<{ challengeId: string }>().challengeId, email);
  }

  async function createBranch(owner: TestBrowser, name: string) {
    const response = await owner.post(`${C}/branches`, { name });
    expect(response.statusCode).toBe(201);
    return response.json<{ id: string; version: number }>();
  }

  async function inviteToken(email: string) {
    const payload = await h.lastEmail(email, 'console.invitation');
    if (!payload) throw new Error(`No invitation emailed to ${email}`);
    return new URL(payload.acceptUrl).pathname.split('/').at(-1)!;
  }

  /** Invites, accepts as a new account and logs in; returns the browser and membership ID. */
  async function addMember(
    inviter: TestBrowser,
    person: { name: string; email: string },
    role: 'manager' | 'staff',
    branchId: string,
  ) {
    const invite = await inviter.post(`${C}/invitations`, { email: person.email, role, branchId });
    expect(invite.statusCode).toBe(201);
    const accept = await new TestBrowser(h.app).post(
      `${C}/invitation-links/${await inviteToken(person.email)}/accept`,
      { name: person.name, password: MEMBER_PASSWORD },
    );
    expect(accept.statusCode).toBe(200);
    const browser = await login(person.email, MEMBER_PASSWORD);
    const me = (await browser.get(`${C}/me`)).json<{ activeMembership: { id: string } }>();
    return { browser, membershipId: me.activeMembership.id };
  }

  return { codeFor, signUp, login, createBranch, inviteToken, addMember };
}
