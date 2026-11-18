// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

export type Role = 'owner' | 'manager' | 'staff';
export type AssignableRole = 'manager' | 'staff';

export interface Member {
  /** Membership ID. */
  id: string;
  name: string;
  email: string;
  role: Role;
  branch: { id: string; name: string } | null;
  status: 'active' | 'deactivated';
  joinedAt: Date;
}

export interface Invitation {
  id: string;
  email: string;
  role: Role;
  branch: { id: string; name: string } | null;
  status: 'pending' | 'expired';
  invitedBy: string | null;
  expiresAt: Date;
}

/** What happens to a branch's current manager when someone else takes the role (FSD 6.8). */
export type CurrentManagerAction =
  { action: 'demote' } | { action: 'move'; branchId: string } | { action: 'deactivate' };

export interface MemberChange {
  role?: AssignableRole;
  branchId?: string;
  currentManager?: CurrentManagerAction;
}

export interface InvitationPreview {
  businessName: string;
  role: Role;
  branchName: string | null;
  email: string;
  accountExists: boolean;
  expiresAt: Date;
}

export interface TeamRepository {
  listMembers(): Promise<Member[]>;
  updateMember(id: string, change: MemberChange): Promise<Member>;
  deactivate(id: string): Promise<Member>;
  reactivate(id: string): Promise<Member>;
  listInvitations(): Promise<Invitation[]>;
  invite(input: { email: string; role: AssignableRole; branchId: string }): Promise<Invitation>;
  resendInvitation(id: string): Promise<Invitation>;
  revokeInvitation(id: string): Promise<void>;
  previewInvitation(token: string): Promise<InvitationPreview>;
  acceptInvitation(token: string, input: { name?: string; password: string }): Promise<void>;
}

/**
 * Roles the signed-in member may hand out (FSD 1.2): owners invite managers and staff,
 * managers invite staff, staff invite nobody.
 */
export function invitableRoles(role: Role): AssignableRole[] {
  if (role === 'owner') return ['manager', 'staff'];
  return role === 'manager' ? ['staff'] : [];
}

/** Mirrors the API's rule; the API remains the authority. */
export function canManage(
  actor: { role: Role; membershipId: string; branchId: string | null },
  member: Member,
): boolean {
  if (member.role === 'owner' || member.id === actor.membershipId) return false;
  if (actor.role === 'owner') return true;
  return (
    actor.role === 'manager' && member.role === 'staff' && member.branch?.id === actor.branchId
  );
}
