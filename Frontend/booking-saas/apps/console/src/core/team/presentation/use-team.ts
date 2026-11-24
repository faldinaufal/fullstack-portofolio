// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AssignableRole,
  Invitation,
  Member,
  MemberChange,
  MemberDetail,
  WorkingHours,
} from '../domain/team';
import { canEditSchedule, canManage, invitableRoles } from '../domain/team';
import { weekHoursProblems, type DayInterval } from '../../shared/domain/week-hours';
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

const memberKey = (id: string) => ['team', 'member', id] as const;
const timeFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

export interface TimeOffRow {
  id: string;
  period: string;
  reason: string;
}

export function toTimeOffRows(member: MemberDetail): TimeOffRow[] {
  return member.timeOff.map((entry) => ({
    id: entry.id,
    period: `${timeFormat.format(entry.startsAt)} – ${timeFormat.format(entry.endsAt)}`,
    reason: entry.reason ?? 'Time off',
  }));
}

/** A member and their schedule, plus what the signed-in member may change. */
export function useMember(id: string, actor: Actor) {
  const { team } = useDependencies();
  return useQuery({
    queryKey: memberKey(id),
    queryFn: () => team.getMember(id),
    select: (member) => {
      const therapist = member.status === 'active' && member.branch !== null;
      return {
        ...member,
        row: toMemberRow(member, actor),
        timeOffRows: toTimeOffRows(member),
        therapist,
        canEditSchedule: therapist && canEditSchedule(actor, member),
        canManageTimeOff:
          therapist && (canEditSchedule(actor, member) || member.id === actor.membershipId),
      };
    },
  });
}

/** Schedule changes refresh the member and the setup status (FSD 3.4). */
function useScheduleMutation<TInput, TResult>(
  id: string,
  run: (input: TInput) => Promise<TResult>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: memberKey(id) });
      await queryClient.invalidateQueries({ queryKey: ['catalogue'] });
    },
  });
}

export function useReplaceWorkingHours(id: string) {
  const { team } = useDependencies();
  return useScheduleMutation(id, (hours: WorkingHours[]) => team.replaceWorkingHours(id, hours));
}

export function useReplaceMemberServices(id: string) {
  const { team } = useDependencies();
  return useScheduleMutation(id, (serviceIds: string[]) => team.replaceServices(id, serviceIds));
}

export function useAddTimeOff(id: string) {
  const { team } = useDependencies();
  return useScheduleMutation(id, (input: { startsAt: Date; endsAt: Date; reason?: string }) =>
    team.addTimeOff(id, input),
  );
}

export function useRemoveTimeOff(id: string) {
  const { team } = useDependencies();
  return useScheduleMutation(id, (timeOffId: string) => team.removeTimeOff(id, timeOffId));
}

/** Therapist photo (FSD 6.15): upload or remove, then show the new detail straight away. */
export function useMemberPhoto(id: string) {
  const { team } = useDependencies();
  const queryClient = useQueryClient();
  const onSuccess = (member: MemberDetail) => queryClient.setQueryData(memberKey(id), member);
  return {
    upload: useMutation({ mutationFn: (file: File) => team.uploadPhoto(id, file), onSuccess }),
    remove: useMutation({ mutationFn: () => team.removePhoto(id), onSuccess }),
  };
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
export { PHOTO_RULE, photoProblem } from '../domain/team';

/** Instant check of a week of working hours (the API also checks the branch hours). */
export function workingHoursProblems(hours: DayInterval[]): Record<number, string> {
  return weekHoursProblems(hours, 'The end of the working day must be after its start.');
}
