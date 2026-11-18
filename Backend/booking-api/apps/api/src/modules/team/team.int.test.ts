// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createHarness, TestBrowser, type Harness } from '../../test/harness.js';

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
const C = '/v1/console';

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
  const response = await owner.post(`${C}/branches`, { name, phone: '+15550147001' });
  expect(response.statusCode).toBe(201);
  return response.json<{ id: string; version: number }>();
}

async function inviteLink(email: string) {
  const payload = await h.lastEmail(email, 'console.invitation');
  if (!payload) throw new Error(`No invitation emailed to ${email}`);
  return new URL(payload.acceptUrl).pathname.split('/').at(-1)!;
}

/** Invites, accepts as a new account and logs in; returns the member's browser. */
async function addMember(
  inviter: TestBrowser,
  person: { name: string; email: string },
  role: 'manager' | 'staff',
  branchId: string,
) {
  const invite = await inviter.post(`${C}/invitations`, { email: person.email, role, branchId });
  expect(invite.statusCode).toBe(201);
  const token = await inviteLink(person.email);
  const password = MEMBER_PASSWORD;
  const accept = await new TestBrowser(h.app).post(`${C}/invitation-links/${token}/accept`, {
    name: person.name,
    password,
  });
  expect(accept.statusCode).toBe(200);
  return login(person.email, password);
}

async function me(user: TestBrowser) {
  return (await user.get(`${C}/me`)).json<{
    activeMembership: {
      id: string;
      role: string;
      branchId: string | null;
      tenant: { slug: string };
    };
    memberships: { id: string; tenant: { slug: string } }[];
  }>();
}

const DANIEL = { name: 'Daniel Kim', email: 'daniel@veloria.test' };
const INES = { name: 'Ines Halvorsen', email: 'ines.halvorsen@veloria.test' };
const OMAR = { name: 'Omar Haddad', email: 'omar@veloria.test' };
/** Must not contain the member's email (FSD 6.11), so it is not derived from their name. */
const MEMBER_PASSWORD = 'quiet river at dawn 4217';

describe('branches', () => {
  it('owner manages branches; manager sees and edits only their own', async () => {
    const owner = await signUp();
    const downtown = await createBranch(owner, 'Downtown');
    const riverside = await createBranch(owner, 'Riverside');
    const manager = await addMember(owner, DANIEL, 'manager', downtown.id);

    const list = (await manager.get(`${C}/branches`)).json<{ items: { id: string }[] }>();
    expect(list.items.map((b) => b.id)).toEqual([downtown.id]);
    expect((await manager.get(`${C}/branches/${riverside.id}`)).statusCode).toBe(404);
    expect((await manager.post(`${C}/branches`, { name: 'Northgate' })).statusCode).toBe(403);

    const hours = await manager.request('PUT', `${C}/branches/${downtown.id}/opening-hours`, {
      hours: [
        { weekday: 1, opensAt: '09:00', closesAt: '18:00' },
        { weekday: 2, opensAt: '09:00', closesAt: '18:00' },
      ],
    });
    expect(hours.statusCode).toBe(200);
    expect(hours.json()).toMatchObject({
      openingHours: [{ weekday: 1, opensAt: '09:00' }, { weekday: 2 }],
    });

    const other = await manager.request('PUT', `${C}/branches/${riverside.id}/opening-hours`, {
      hours: [],
    });
    expect(other.statusCode).toBe(404);
  });

  it('validates opening hours and closures', async () => {
    const owner = await signUp();
    const branch = await createBranch(owner, 'Downtown');

    const backwards = await owner.request('PUT', `${C}/branches/${branch.id}/opening-hours`, {
      hours: [{ weekday: 1, opensAt: '18:00', closesAt: '09:00' }],
    });
    expect(backwards.statusCode).toBe(400);
    const twice = await owner.request('PUT', `${C}/branches/${branch.id}/opening-hours`, {
      hours: [
        { weekday: 1, opensAt: '09:00', closesAt: '12:00' },
        { weekday: 1, opensAt: '13:00', closesAt: '18:00' },
      ],
    });
    expect(twice.statusCode).toBe(400);

    const closure = await owner.post(`${C}/branches/${branch.id}/closures`, {
      startsOn: '2026-12-24',
      endsOn: '2026-12-26',
      reason: 'Winter holidays',
    });
    expect(closure.statusCode).toBe(201);
    const { id } = closure.json<{ id: string }>();
    expect((await owner.get(`${C}/branches/${branch.id}`)).json()).toMatchObject({
      closures: [{ id, startsOn: '2026-12-24', endsOn: '2026-12-26' }],
    });
    expect(
      (await owner.request('DELETE', `${C}/branches/${branch.id}/closures/${id}`)).statusCode,
    ).toBe(204);
  });

  it('rejects an update made from a stale version (optimistic locking)', async () => {
    const owner = await signUp();
    const branch = await createBranch(owner, 'Downtown');

    const first = await owner.request(
      'PATCH',
      `${C}/branches/${branch.id}`,
      { name: 'Downtown Central' },
      {
        'if-match': String(branch.version),
      },
    );
    expect(first.statusCode).toBe(200);
    const stale = await owner.request(
      'PATCH',
      `${C}/branches/${branch.id}`,
      { name: 'Old Town' },
      {
        'if-match': String(branch.version),
      },
    );
    expect(stale.statusCode).toBe(409);
    expect(stale.json()).toMatchObject({ code: 'VERSION_CONFLICT' });
  });

  it('cannot be archived while members work there', async () => {
    const owner = await signUp();
    const branch = await createBranch(owner, 'Downtown');
    await addMember(owner, INES, 'staff', branch.id);

    const blocked = await owner.post(`${C}/branches/${branch.id}/archive`);
    expect(blocked.statusCode).toBe(409);
    expect(blocked.json()).toMatchObject({ code: 'HAS_ACTIVE_MEMBERS' });
  });
});

describe('invitations', () => {
  it('lets a new person join as manager of a branch and log in', async () => {
    const owner = await signUp();
    const branch = await createBranch(owner, 'Downtown');
    await owner.post(`${C}/invitations`, {
      email: DANIEL.email,
      role: 'manager',
      branchId: branch.id,
    });

    const token = await inviteLink(DANIEL.email);
    const preview = await new TestBrowser(h.app).get(`${C}/invitation-links/${token}`);
    expect(preview.json()).toMatchObject({
      businessName: OWNER.businessName,
      role: 'manager',
      branchName: 'Downtown',
      accountExists: false,
    });

    const short = await new TestBrowser(h.app).post(`${C}/invitation-links/${token}/accept`, {
      name: DANIEL.name,
      password: 'too short',
    });
    expect(short.statusCode).toBe(400);

    const manager = await addMemberWithToken(token, DANIEL);
    expect((await me(manager)).activeMembership).toMatchObject({
      role: 'manager',
      branchId: branch.id,
    });

    const reused = await new TestBrowser(h.app).get(`${C}/invitation-links/${token}`);
    expect(reused.statusCode).toBe(410);
  });

  it('applies the invite rights of each role', async () => {
    const owner = await signUp();
    const downtown = await createBranch(owner, 'Downtown');
    const riverside = await createBranch(owner, 'Riverside');
    const manager = await addMember(owner, DANIEL, 'manager', downtown.id);

    const staffOwnBranch = await manager.post(`${C}/invitations`, {
      email: INES.email,
      role: 'staff',
      branchId: downtown.id,
    });
    expect(staffOwnBranch.statusCode).toBe(201);
    const otherBranch = await manager.post(`${C}/invitations`, {
      email: OMAR.email,
      role: 'staff',
      branchId: riverside.id,
    });
    expect(otherBranch.statusCode).toBe(403);
    const managerRole = await manager.post(`${C}/invitations`, {
      email: OMAR.email,
      role: 'manager',
      branchId: downtown.id,
    });
    expect(managerRole.statusCode).toBe(403);

    const staff = await addMemberWithToken(await inviteLink(INES.email), INES);
    expect((await staff.get(`${C}/members`)).statusCode).toBe(403);
    expect(
      (
        await staff.post(`${C}/invitations`, {
          email: OMAR.email,
          role: 'staff',
          branchId: downtown.id,
        })
      ).statusCode,
    ).toBe(403);
  });

  it('rejects duplicates, existing members and a second manager', async () => {
    const owner = await signUp();
    const branch = await createBranch(owner, 'Downtown');
    await addMember(owner, DANIEL, 'manager', branch.id);

    const member = await owner.post(`${C}/invitations`, {
      email: DANIEL.email,
      role: 'staff',
      branchId: branch.id,
    });
    expect(member.json()).toMatchObject({ code: 'ALREADY_MEMBER' });

    await owner.post(`${C}/invitations`, { email: INES.email, role: 'staff', branchId: branch.id });
    const again = await owner.post(`${C}/invitations`, {
      email: INES.email,
      role: 'staff',
      branchId: branch.id,
    });
    expect(again.json()).toMatchObject({ code: 'INVITATION_PENDING' });

    const secondManager = await owner.post(`${C}/invitations`, {
      email: OMAR.email,
      role: 'manager',
      branchId: branch.id,
    });
    expect(secondManager.json()).toMatchObject({ code: 'BRANCH_HAS_MANAGER' });
  });

  it('expires after 7 days; resend replaces the link; revoke ends it', async () => {
    const owner = await signUp();
    const branch = await createBranch(owner, 'Downtown');
    const invite = await owner.post(`${C}/invitations`, {
      email: INES.email,
      role: 'staff',
      branchId: branch.id,
    });
    const { id } = invite.json<{ id: string }>();
    const firstToken = await inviteLink(INES.email);

    h.clock.advance(7 * 24 * 60 * 60_000 + 1_000);
    expect(
      (await new TestBrowser(h.app).get(`${C}/invitation-links/${firstToken}`)).statusCode,
    ).toBe(410);

    // A week later the owner's session has ended too (12 h idle): log in again.
    const ownerAgain = await login(OWNER.email, OWNER.password);
    expect((await ownerAgain.post(`${C}/invitations/${id}/resend`)).statusCode).toBe(200);
    const secondToken = await inviteLink(INES.email);
    expect(secondToken).not.toBe(firstToken);
    expect(
      (await new TestBrowser(h.app).get(`${C}/invitation-links/${secondToken}`)).statusCode,
    ).toBe(200);

    expect((await ownerAgain.request('DELETE', `${C}/invitations/${id}`)).statusCode).toBe(204);
    const revoked = await new TestBrowser(h.app).post(
      `${C}/invitation-links/${secondToken}/accept`,
      {
        name: INES.name,
        password: 'Ines long passphrase',
      },
    );
    expect(revoked.json()).toMatchObject({ code: 'INVITATION_EXPIRED' });
  });

  it('lets an existing Console account join with its password and switch businesses', async () => {
    const lumenOwner = await signUp();
    const branch = await createBranch(lumenOwner, 'Downtown');
    const harborOwner = await signUp({
      ...OWNER,
      name: DANIEL.name,
      email: DANIEL.email,
      businessName: 'Harbor Physio Clinic',
      slug: 'harbor',
    });

    await lumenOwner.post(`${C}/invitations`, {
      email: DANIEL.email,
      role: 'staff',
      branchId: branch.id,
    });
    const token = await inviteLink(DANIEL.email);
    expect(
      (await new TestBrowser(h.app).get(`${C}/invitation-links/${token}`)).json(),
    ).toMatchObject({
      accountExists: true,
    });

    const wrong = await new TestBrowser(h.app).post(`${C}/invitation-links/${token}/accept`, {
      password: 'not the right password',
    });
    expect(wrong.statusCode).toBe(401);
    const ok = await new TestBrowser(h.app).post(`${C}/invitation-links/${token}/accept`, {
      password: OWNER.password,
    });
    expect(ok.statusCode).toBe(200);

    const session = await me(harborOwner);
    expect(session.memberships.map((m) => m.tenant.slug).sort()).toEqual(['harbor', 'lumen']);
    const lumen = session.memberships.find((m) => m.tenant.slug === 'lumen')!;
    expect(
      (await harborOwner.post(`${C}/me/active-membership`, { membershipId: lumen.id })).statusCode,
    ).toBe(200);
    expect((await me(harborOwner)).activeMembership).toMatchObject({
      role: 'staff',
      tenant: { slug: 'lumen' },
    });
  });
});

async function addMemberWithToken(token: string, person: { name: string; email: string }) {
  const password = MEMBER_PASSWORD;
  const accept = await new TestBrowser(h.app).post(`${C}/invitation-links/${token}/accept`, {
    name: person.name,
    password,
  });
  expect(accept.statusCode).toBe(200);
  return login(person.email, password);
}

describe('members', () => {
  it('replacing a manager needs a decision about the current one', async () => {
    const owner = await signUp();
    const branch = await createBranch(owner, 'Downtown');
    const manager = await addMember(owner, DANIEL, 'manager', branch.id);
    await addMember(owner, INES, 'staff', branch.id);
    const members = (await owner.get(`${C}/members`)).json<{
      items: { id: string; email: string; role: string }[];
    }>();
    const ines = members.items.find((m) => m.email === INES.email)!;
    const daniel = members.items.find((m) => m.email === DANIEL.email)!;

    const undecided = await owner.request('PATCH', `${C}/members/${ines.id}`, { role: 'manager' });
    expect(undecided.json()).toMatchObject({ code: 'BRANCH_HAS_MANAGER' });

    const promoted = await owner.request('PATCH', `${C}/members/${ines.id}`, {
      role: 'manager',
      currentManager: { action: 'demote' },
    });
    expect(promoted.json()).toMatchObject({ role: 'manager' });
    expect((await owner.get(`${C}/members/${daniel.id}`)).json()).toMatchObject({ role: 'staff' });
    // A demoted member's sessions end at once (FSD 6.8).
    expect((await manager.get(`${C}/me`)).statusCode).toBe(401);
  });

  it('deactivation ends access immediately; managers manage only their staff', async () => {
    const owner = await signUp();
    const downtown = await createBranch(owner, 'Downtown');
    const riverside = await createBranch(owner, 'Riverside');
    const manager = await addMember(owner, DANIEL, 'manager', downtown.id);
    const staff = await addMember(owner, INES, 'staff', downtown.id);
    await addMember(owner, OMAR, 'staff', riverside.id);
    const all = (await owner.get(`${C}/members`)).json<{
      items: { id: string; email: string; role: string }[];
    }>();
    const id = (email: string) => all.items.find((m) => m.email === email)!.id;

    const managerView = (await manager.get(`${C}/members`)).json<{ items: { email: string }[] }>();
    expect(managerView.items.map((m) => m.email).sort()).toEqual([DANIEL.email, INES.email]);
    expect((await manager.post(`${C}/members/${id(OMAR.email)}/deactivate`)).statusCode).toBe(404);
    expect((await manager.post(`${C}/members/${id(DANIEL.email)}/deactivate`)).statusCode).toBe(
      403,
    );
    expect((await manager.post(`${C}/members/${id(OWNER.email)}/deactivate`)).statusCode).toBe(404);

    expect((await manager.post(`${C}/members/${id(INES.email)}/deactivate`)).statusCode).toBe(200);
    expect((await staff.get(`${C}/me`)).statusCode).toBe(401);
    const relogin = await new TestBrowser(h.app).post(`${C}/auth/login`, {
      email: INES.email,
      password: MEMBER_PASSWORD,
    });
    expect(relogin.json()).toMatchObject({ code: 'FORBIDDEN' });

    expect((await manager.post(`${C}/members/${id(INES.email)}/reactivate`)).statusCode).toBe(200);
  });
});

describe('audit log', () => {
  it('records every change and cannot be altered by the API role', async () => {
    const owner = await signUp();
    const branch = await createBranch(owner, 'Downtown');
    await owner.post(`${C}/invitations`, { email: INES.email, role: 'staff', branchId: branch.id });

    const entries = await h.owner.auditLog.findMany({ orderBy: { createdAt: 'asc' } });
    expect(entries.map((e) => e.action)).toEqual(['branch.created', 'invitation.created']);
    expect(entries[0]).toMatchObject({
      actorType: 'team_member',
      actorLabel: OWNER.name,
      branchId: branch.id,
    });
    expect(entries[0]!.requestId).toEqual(expect.any(String));

    await expect(
      h.prisma.$executeRawUnsafe('UPDATE audit_logs SET action = $1', 'tampered'),
    ).rejects.toThrow(/permission denied/);
    await expect(h.prisma.$executeRawUnsafe('DELETE FROM audit_logs')).rejects.toThrow(
      /permission denied/,
    );
  });
});

describe('tenant isolation', () => {
  it("one business never sees another's branches, members or invitations", async () => {
    const lumen = await signUp();
    const downtown = await createBranch(lumen, 'Downtown');
    await lumen.post(`${C}/invitations`, {
      email: INES.email,
      role: 'staff',
      branchId: downtown.id,
    });
    const harbor = await signUp({
      ...OWNER,
      name: DANIEL.name,
      email: DANIEL.email,
      businessName: 'Harbor Physio Clinic',
      slug: 'harbor',
    });

    expect((await harbor.get(`${C}/branches`)).json()).toEqual({ items: [] });
    expect((await harbor.get(`${C}/branches/${downtown.id}`)).statusCode).toBe(404);
    expect((await harbor.get(`${C}/invitations`)).json()).toEqual({ items: [] });
    const members = (await harbor.get(`${C}/members`)).json<{ items: { email: string }[] }>();
    expect(members.items.map((m) => m.email)).toEqual([DANIEL.email]);
    const invite = await harbor.post(`${C}/invitations`, {
      email: OMAR.email,
      role: 'staff',
      branchId: downtown.id,
    });
    expect(invite.statusCode).toBe(404);
  });
});
