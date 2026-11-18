// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { ApiError } from '@tempora/api-client';
import { describe, expect, it } from 'vitest';
import { toRequestError } from '../shared/data/to-request-error';
import { toRequestErrorView } from '../shared/presentation/error-view';
import { canManage, invitableRoles, type Member } from './domain/team';
import { toInvitationRow, toMemberRow } from './presentation/use-team';

const member = (overrides: Partial<Member>): Member => ({
  id: 'fa1d0000-0000-4000-8000-000000000010',
  name: 'Ines Halvorsen',
  email: 'ines.halvorsen@veloria.test',
  role: 'staff',
  branch: { id: 'downtown', name: 'Downtown' },
  status: 'active',
  joinedAt: new Date('2026-11-18T12:00:00Z'),
  ...overrides,
});

const owner = { role: 'owner' as const, membershipId: 'owner', branchId: null };
const manager = { role: 'manager' as const, membershipId: 'manager', branchId: 'downtown' };

describe('team rules', () => {
  it('lists the roles each role may invite', () => {
    expect(invitableRoles('owner')).toEqual(['manager', 'staff']);
    expect(invitableRoles('manager')).toEqual(['staff']);
    expect(invitableRoles('staff')).toEqual([]);
  });

  it('lets managers manage only staff of their branch, and nobody the owner', () => {
    expect(canManage(manager, member({}))).toBe(true);
    expect(canManage(manager, member({ branch: { id: 'riverside', name: 'Riverside' } }))).toBe(
      false,
    );
    expect(canManage(manager, member({ role: 'manager' }))).toBe(false);
    expect(canManage(owner, member({ id: 'owner', role: 'owner', branch: null }))).toBe(false);
  });
});

describe('team view-models', () => {
  it('describes a member row', () => {
    expect(toMemberRow(member({ status: 'deactivated' }), manager)).toMatchObject({
      roleLabel: 'Staff',
      branchName: 'Downtown',
      active: false,
      joined: '18 Nov 2026',
      manageable: true,
    });
  });

  it('describes an invitation, expired or not', () => {
    const row = toInvitationRow({
      id: 'i',
      email: 'omar@veloria.test',
      role: 'manager',
      branch: { id: 'downtown', name: 'Downtown' },
      status: 'expired',
      invitedBy: 'Maya Reyes',
      expiresAt: new Date('2026-11-25T12:00:00Z'),
    });
    expect(row).toMatchObject({ expired: true, roleLabel: 'Manager' });
    expect(row.detail).toBe('Expired 25 Nov 2026 · invited by Maya Reyes');
  });
});

describe('request errors', () => {
  it("keeps the API's detail for rule errors and a fixed message for generic ones", () => {
    const rule = toRequestError(
      new ApiError({
        status: 409,
        code: 'BRANCH_HAS_MANAGER',
        message: 'Daniel Kim already manages this branch.',
      }),
    );
    expect(toRequestErrorView(rule)?.message).toBe('Daniel Kim already manages this branch.');

    const generic = toRequestError(
      new ApiError({ status: 404, code: 'NOT_FOUND', message: 'Branch not found.' }),
    );
    expect(toRequestErrorView(generic)?.message).toMatch(/outside your branch/);
  });

  it('shows a reference only for unexpected errors', () => {
    const crash = toRequestError(
      new ApiError({ status: 500, code: 'INTERNAL_ERROR', message: 'x', requestId: 'req-4217' }),
    );
    expect(toRequestErrorView(crash)).toMatchObject({
      message: 'Something went wrong. Please try again.',
      reference: 'req-4217',
    });
    const conflict = toRequestError(
      new ApiError({ status: 409, code: 'VERSION_CONFLICT', message: 'x', requestId: 'req-1' }),
    );
    expect(toRequestErrorView(conflict)?.reference).toBeUndefined();
  });
});
