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

/** Weekly working interval, `HH:MM` in the platform time zone (0 = Sunday). */
export interface WorkingHours {
  weekday: number;
  startsAt: string;
  endsAt: string;
}

export interface TimeOff {
  id: string;
  startsAt: Date;
  endsAt: Date;
  reason: string | null;
}

/** A member with their schedule (FSD 2.2 Team member detail, My schedule). */
export interface MemberDetail extends Member {
  /** Therapist photo shown to customers (FSD 6.15); null shows the initials. */
  photoUrl: string | null;
  workingHours: WorkingHours[];
  services: { id: string; name: string }[];
  timeOff: TimeOff[];
}

export interface TeamRepository {
  listMembers(): Promise<Member[]>;
  getMember(id: string): Promise<MemberDetail>;
  replaceWorkingHours(id: string, hours: WorkingHours[]): Promise<MemberDetail>;
  replaceServices(id: string, serviceIds: string[]): Promise<MemberDetail>;
  addTimeOff(
    id: string,
    input: { startsAt: Date; endsAt: Date; reason?: string },
  ): Promise<TimeOff>;
  removeTimeOff(id: string, timeOffId: string): Promise<void>;
  uploadPhoto(id: string, file: File): Promise<MemberDetail>;
  removePhoto(id: string): Promise<MemberDetail>;
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
/** Mirrors the API: owner for anyone, a manager for members of their branch. */
export function canEditSchedule(
  actor: { role: Role; branchId: string | null },
  member: Pick<Member, 'branch'>,
): boolean {
  if (actor.role === 'owner') return true;
  return actor.role === 'manager' && member.branch?.id === actor.branchId;
}

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

/** Same rules as the API (FSD 6.15): a PNG, JPEG or WebP of at most 1 MB. */
export const PHOTO_RULE = {
  maxBytes: 1024 * 1024,
  types: ['image/png', 'image/jpeg', 'image/webp'],
} as const;

/** Why a chosen photo cannot be used, before anything is uploaded; null when it is fine. */
export function photoProblem(file: { type: string; size: number }): string | null {
  if (!(PHOTO_RULE.types as readonly string[]).includes(file.type)) {
    return 'Choose a PNG, JPEG or WebP image.';
  }
  if (file.size > PHOTO_RULE.maxBytes) return 'The file is too large: at most 1 MB.';
  return null;
}
