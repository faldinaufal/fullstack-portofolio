// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AssignableRole, Invitation, Member, MemberChange } from '../domain/team';
import { canManage, invitableRoles } from '../domain/team';
import { useDependencies } from '../../shared/presentation/dependencies';

const MEMBERS = ['team', 'members'] as const;
const INVITATIONS = ['team', 'invitations'] as const;

const ROLE_LABEL: Record<Member['role'], string> = {
  owner: 'Owner',
  manager: 'Manager',
  staff: 'Staff',
};
const shortDate = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

export interface MemberRow {
  id: string;
  name: string;
  email: string;
  roleLabel: string;
  role: Member['role'];
  branchId: string | null;
  branchName: string;
  active: boolean;
  joined: string;
  /** The signed-in member may deactivate / reactivate this one. */
  manageable: boolean;
}

export interface InvitationRow {
  id: string;
  email: string;
  roleLabel: string;
  branchName: string;
  expired: boolean;
  detail: string;
}

export interface Actor {
  role: Member['role'];
  membershipId: string;
  branchId: string | null;
}

export function toMemberRow(member: Member, actor: Actor): MemberRow {
  return {
    id: member.id,
    name: member.name,
    email: member.email,
    roleLabel: ROLE_LABEL[member.role],
    role: member.role,
    branchId: member.branch?.id ?? null,
    branchName: member.branch?.name ?? 'All branches',
    active: member.status === 'active',
    joined: shortDate.format(member.joinedAt),
    manageable: canManage(actor, member),
  };
}

export function toInvitationRow(invitation: Invitation): InvitationRow {
  const expired = invitation.status === 'expired';
  return {
    id: invitation.id,
    email: invitation.email,
    roleLabel: ROLE_LABEL[invitation.role],
    branchName: invitation.branch?.name ?? 'All branches',
    expired,
    detail: `${expired ? 'Expired' : 'Expires'} ${shortDate.format(invitation.expiresAt)}${
      invitation.invitedBy ? ` · invited by ${invitation.invitedBy}` : ''
    }`,
  };
}

export function useMembers(actor: Actor) {
  const { team } = useDependencies();
  return useQuery({
    queryKey: MEMBERS,
    queryFn: () => team.listMembers(),
    select: (members) => members.map((member) => toMemberRow(member, actor)),
  });
}

export function useInvitations() {
  const { team } = useDependencies();
  return useQuery({
    queryKey: INVITATIONS,
    queryFn: () => team.listInvitations(),
    select: (items) => items.map(toInvitationRow),
  });
}

/** Every team change can affect both lists (e.g. accepting removes an invitation). */
function useTeamMutation<TInput, TResult>(run: (input: TInput) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['team'] });
      await queryClient.invalidateQueries({ queryKey: ['branches'] });
    },
  });
}

export function useInvite() {
  const { team } = useDependencies();
  return useTeamMutation((input: { email: string; role: AssignableRole; branchId: string }) =>
    team.invite(input),
  );
}

export function useResendInvitation() {
  const { team } = useDependencies();
  return useTeamMutation((id: string) => team.resendInvitation(id));
}

export function useRevokeInvitation() {
  const { team } = useDependencies();
  return useTeamMutation((id: string) => team.revokeInvitation(id));
}

export function useUpdateMember() {
  const { team } = useDependencies();
  return useTeamMutation(({ id, change }: { id: string; change: MemberChange }) =>
    team.updateMember(id, change),
  );
}

export function useSetMemberActive() {
  const { team } = useDependencies();
  return useTeamMutation(({ id, active }: { id: string; active: boolean }) =>
    active ? team.reactivate(id) : team.deactivate(id),
  );
}

export function useInvitationPreview(token: string) {
  const { team } = useDependencies();
  return useQuery({
    queryKey: ['invitation-link', token],
    queryFn: () => team.previewInvitation(token),
    retry: false,
    select: (preview) => ({
      ...preview,
      roleLabel: ROLE_LABEL[preview.role].toLowerCase(),
      place: preview.branchName ? `at ${preview.branchName}` : '',
    }),
  });
}

export function useAcceptInvitation(token: string) {
  const { team } = useDependencies();
  return useMutation({
    mutationFn: (input: { name?: string; password: string }) => team.acceptInvitation(token, input),
  });
}

export { invitableRoles };
