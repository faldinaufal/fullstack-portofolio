// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { MembershipRole, Tx } from '@tempora/db';

const memberInclude = {
  teamAccount: { select: { id: true, name: true, email: true } },
  branch: { select: { id: true, name: true, archivedAt: true } },
} as const;

const invitationInclude = {
  branch: { select: { id: true, name: true } },
  invitedBy: { select: { teamAccount: { select: { name: true } } } },
} as const;

/** Team queries; each runs in a transaction with the caller's tenant context (RLS). */
export const teamRepository = {
  // --- members --------------------------------------------------------------
  listMembers: (tx: Tx, tenantId: string, branchId?: string) =>
    tx.membership.findMany({
      where: { tenantId, ...(branchId && { branchId }) },
      include: memberInclude,
      orderBy: [{ status: 'asc' }, { role: 'asc' }, { createdAt: 'asc' }],
    }),

  findMember: (tx: Tx, tenantId: string, id: string) =>
    tx.membership.findFirst({ where: { tenantId, id }, include: memberInclude }),

  findMemberByAccount: (tx: Tx, tenantId: string, teamAccountId: string) =>
    tx.membership.findFirst({ where: { tenantId, teamAccountId } }),

  activeManagerOf: (tx: Tx, branchId: string) =>
    tx.membership.findFirst({
      where: { branchId, role: 'manager', status: 'active' },
      include: memberInclude,
    }),

  updateMember: (
    tx: Tx,
    id: string,
    data: { role?: MembershipRole; branchId?: string | null; status?: 'active' | 'deactivated' },
  ) => tx.membership.update({ where: { id }, data, include: memberInclude }),

  createMembership: (
    tx: Tx,
    data: {
      tenantId: string;
      teamAccountId: string;
      role: MembershipRole;
      branchId: string | null;
    },
  ) => tx.membership.create({ data }),

  findBranch: (tx: Tx, tenantId: string, id: string) =>
    tx.branch.findFirst({ where: { tenantId, id } }),

  // --- accounts (not tenant-owned) -----------------------------------------
  findAccountByEmail: (tx: Tx, email: string) => tx.teamAccount.findUnique({ where: { email } }),

  createAccount: (tx: Tx, data: { email: string; name: string; passwordHash: string; now: Date }) =>
    tx.teamAccount.create({
      data: {
        email: data.email,
        name: data.name,
        passwordHash: data.passwordHash,
        // The invitation link was delivered to this address, which proves it.
        emailVerifiedAt: data.now,
      },
    }),

  revokeMembershipSessions: (tx: Tx, membershipId: string, now: Date) =>
    tx.session.updateMany({ where: { membershipId, revokedAt: null }, data: { revokedAt: now } }),

  revokeTrustedDevices: (tx: Tx, teamAccountId: string, now: Date) =>
    tx.trustedDevice.updateMany({
      where: { teamAccountId, revokedAt: null },
      data: { revokedAt: now },
    }),

  // --- invitations ----------------------------------------------------------
  listOpenInvitations: (tx: Tx, tenantId: string, branchId?: string) =>
    tx.invitation.findMany({
      where: { tenantId, acceptedAt: null, revokedAt: null, ...(branchId && { branchId }) },
      include: invitationInclude,
      orderBy: { createdAt: 'desc' },
    }),

  findInvitation: (tx: Tx, tenantId: string, id: string) =>
    tx.invitation.findFirst({ where: { tenantId, id }, include: invitationInclude }),

  /** Readable only through the invitation-token RLS context (before any login). */
  findInvitationByToken: (tx: Tx, tokenHash: string) =>
    tx.invitation.findFirst({
      where: { tokenHash },
      include: { tenant: { select: { name: true, archivedAt: true } } },
    }),

  findOpenInvitationForEmail: (tx: Tx, tenantId: string, email: string) =>
    tx.invitation.findFirst({ where: { tenantId, email, acceptedAt: null, revokedAt: null } }),

  createInvitation: (
    tx: Tx,
    data: {
      tenantId: string;
      email: string;
      role: MembershipRole;
      branchId: string | null;
      tokenHash: string;
      invitedByMembershipId: string;
      now: Date;
      expiresAt: Date;
    },
  ) =>
    tx.invitation.create({
      data: {
        tenantId: data.tenantId,
        email: data.email,
        role: data.role,
        branchId: data.branchId,
        tokenHash: data.tokenHash,
        invitedByMembershipId: data.invitedByMembershipId,
        createdAt: data.now,
        expiresAt: data.expiresAt,
      },
      include: invitationInclude,
    }),

  renewInvitation: (tx: Tx, id: string, data: { tokenHash: string; expiresAt: Date }) =>
    tx.invitation.update({ where: { id }, data, include: invitationInclude }),

  revokeInvitation: (tx: Tx, id: string, now: Date) =>
    tx.invitation.update({ where: { id }, data: { revokedAt: now } }),

  /** Single use: false when another request accepted or revoked it first. */
  markAccepted: async (tx: Tx, id: string, now: Date) =>
    (
      await tx.invitation.updateMany({
        where: { id, acceptedAt: null, revokedAt: null },
        data: { acceptedAt: now },
      })
    ).count === 1,
};

export type MemberRow = NonNullable<Awaited<ReturnType<typeof teamRepository.findMember>>>;
export type InvitationRow = NonNullable<Awaited<ReturnType<typeof teamRepository.findInvitation>>>;
