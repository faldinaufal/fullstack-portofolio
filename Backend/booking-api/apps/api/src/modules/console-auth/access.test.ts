// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { describe, expect, it } from 'vitest';
import {
  canEditBranch,
  canInvite,
  canManageMember,
  canSeeBranch,
  canSeeMember,
  type MemberRef,
  type Scope,
} from './access.js';

const A = 'branch-a';
const B = 'branch-b';
const owner: Scope = { role: 'owner', branchId: null, membershipId: 'owner' };
const managerA: Scope = { role: 'manager', branchId: A, membershipId: 'manager-a' };
const staffA: Scope = { role: 'staff', branchId: A, membershipId: 'staff-a' };

const member = (id: string, role: MemberRef['role'], branchId: string | null): MemberRef => ({
  id,
  role,
  branchId,
});

describe('branches (FSD 1.2)', () => {
  it('owner sees and edits every branch; others only their own', () => {
    expect(canSeeBranch(owner, B)).toBe(true);
    expect(canSeeBranch(managerA, A)).toBe(true);
    expect(canSeeBranch(managerA, B)).toBe(false);
    expect(canEditBranch(managerA, A)).toBe(true);
    expect(canEditBranch(managerA, B)).toBe(false);
    expect(canEditBranch(staffA, A)).toBe(false);
  });
});

describe('invitations', () => {
  it('owner invites managers and staff anywhere', () => {
    expect(canInvite(owner, 'manager', B)).toBe(true);
    expect(canInvite(owner, 'staff', A)).toBe(true);
  });

  it('a manager invites staff to their own branch only', () => {
    expect(canInvite(managerA, 'staff', A)).toBe(true);
    expect(canInvite(managerA, 'staff', B)).toBe(false);
    expect(canInvite(managerA, 'manager', A)).toBe(false);
  });

  it('staff cannot invite', () => {
    expect(canInvite(staffA, 'staff', A)).toBe(false);
  });
});

describe('members', () => {
  const ownerRef = member('owner', 'owner', null);
  const managerRefA = member('manager-a', 'manager', A);
  const staffRefA = member('staff-a', 'staff', A);
  const staffRefB = member('staff-b', 'staff', B);

  it('limits who can see whom', () => {
    expect(canSeeMember(owner, staffRefB)).toBe(true);
    expect(canSeeMember(managerA, staffRefA)).toBe(true);
    expect(canSeeMember(managerA, staffRefB)).toBe(false);
    expect(canSeeMember(staffA, staffRefA)).toBe(true);
    expect(canSeeMember(staffA, managerRefA)).toBe(false);
  });

  it('nobody manages the owner or themselves; managers manage their staff only', () => {
    expect(canManageMember(owner, ownerRef)).toBe(false);
    expect(canManageMember(owner, managerRefA)).toBe(true);
    expect(canManageMember(managerA, managerRefA)).toBe(false);
    expect(canManageMember(managerA, staffRefA)).toBe(true);
    expect(canManageMember(managerA, staffRefB)).toBe(false);
    expect(canManageMember(staffA, member('staff-a2', 'staff', A))).toBe(false);
  });
});
