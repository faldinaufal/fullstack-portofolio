// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  Icon,
  Select,
  TextField,
} from '@tempora/ui';
import Link from 'next/link';
import { useState, type SubmitEvent } from 'react';
import { useCurrentMember } from '@/core/auth/presentation/use-auth';
import { useBranches } from '@/core/branches/presentation/use-branches';
import { toRequestErrorView } from '@/core/shared/presentation/error-view';
import {
  invitableRoles,
  useInvitations,
  useInvite,
  useMembers,
  useResendInvitation,
  useRevokeInvitation,
  useSetMemberActive,
  useUpdateMember,
  type MemberRow,
} from '@/core/team/presentation/use-team';
import { PageHeader } from '@/ui/common/page-header';
import { RequestErrorAlert } from '@/ui/common/request-error';
import { SidePanel } from '@/ui/common/side-panel';
import { formText } from '@/ui/common/form-values';

/** FSD 2.2 Team: owner manages everyone; a manager manages the staff of their branch. */
export function TeamScreen() {
  const me = useCurrentMember();
  const members = useMembers(me);
  const [inviting, setInviting] = useState(false);
  const [editing, setEditing] = useState<MemberRow | null>(null);
  const [toggling, setToggling] = useState<MemberRow | null>(null);
  const setActive = useSetMemberActive();

  return (
    <>
      <PageHeader
        title="Team"
        description={
          me.role === 'owner' ? 'Everyone who works in your business.' : 'The team of your branch.'
        }
        actions={
          <Button onClick={() => setInviting(true)}>
            <Icon name="plus" size={18} /> Invite
          </Button>
        }
      />

      <RequestErrorAlert error={toRequestErrorView(members.error ?? setActive.error)} />

      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="text-left text-[13px] text-muted">
                <th scope="col" className="px-5 py-3 font-semibold">
                  Name
                </th>
                <th scope="col" className="px-3 py-3 font-semibold">
                  Role
                </th>
                <th scope="col" className="px-3 py-3 font-semibold">
                  Branch
                </th>
                <th scope="col" className="px-3 py-3 font-semibold">
                  Status
                </th>
                <th scope="col" className="px-5 py-3 text-right font-semibold">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {members.isPending && (
                <tr>
                  <td colSpan={5} className="px-5 py-6 text-muted">
                    Loading members…
                  </td>
                </tr>
              )}
              {members.data?.map((member) => (
                <tr key={member.id} className="border-t border-border">
                  <td className="px-5 py-3">
                    <Link
                      href={`/team/${member.id}`}
                      className="block font-bold text-foreground hover:text-primary-text"
                    >
                      {member.name}
                    </Link>
                    <span className="text-[13px] text-muted">{member.email}</span>
                  </td>
                  <td className="px-3 py-3">{member.roleLabel}</td>
                  <td className="px-3 py-3">{member.branchName}</td>
                  <td className="px-3 py-3">
                    <Badge tone={member.active ? 'success' : 'neutral'} dot>
                      {member.active ? 'Active' : 'Deactivated'}
                    </Badge>
                  </td>
                  <td className="px-5 py-3 text-right whitespace-nowrap">
                    {member.manageable && me.role === 'owner' && member.active && (
                      <Button variant="ghost" size="sm" onClick={() => setEditing(member)}>
                        Change
                      </Button>
                    )}
                    {member.manageable && (
                      <Button variant="ghost" size="sm" onClick={() => setToggling(member)}>
                        {member.active ? 'Deactivate' : 'Reactivate'}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <InvitationsCard />

      <InvitePanel open={inviting} onClose={() => setInviting(false)} />
      {editing && <ChangeMemberPanel member={editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={toggling !== null}
        title={
          toggling?.active ? `Deactivate ${toggling.name}?` : `Reactivate ${toggling?.name ?? ''}?`
        }
        confirmLabel={toggling?.active ? 'Deactivate' : 'Reactivate'}
        destructive={toggling?.active ?? false}
        busy={setActive.isPending}
        onCancel={() => setToggling(null)}
        onConfirm={() =>
          toggling &&
          setActive.mutate(
            { id: toggling.id, active: !toggling.active },
            { onSettled: () => setToggling(null) },
          )
        }
      >
        {toggling?.active
          ? 'They are logged out on every device immediately and cannot log in to this business until reactivated.'
          : 'They can log in again with their existing account.'}
      </ConfirmDialog>
    </>
  );
}

function InvitationsCard() {
  const invitations = useInvitations();
  const resend = useResendInvitation();
  const revoke = useRevokeInvitation();
  const error = toRequestErrorView(invitations.error ?? resend.error ?? revoke.error);

  if (invitations.data?.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Open invitations</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <RequestErrorAlert error={error} />
        {invitations.data?.map((invitation) => (
          <div
            key={invitation.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-muted/50 px-4 py-3"
          >
            <span>
              <span className="block font-bold">{invitation.email}</span>
              <span className="text-[13px] text-muted">
                {invitation.roleLabel} · {invitation.branchName} · {invitation.detail}
              </span>
            </span>
            <span className="flex gap-1">
              {invitation.expired && <Badge tone="warning">Expired</Badge>}
              <Button
                variant="ghost"
                size="sm"
                disabled={resend.isPending}
                onClick={() => resend.mutate(invitation.id)}
              >
                Resend
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={revoke.isPending}
                onClick={() => revoke.mutate(invitation.id)}
              >
                Revoke
              </Button>
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function useBranchOptions() {
  const branches = useBranches();
  return (branches.data ?? [])
    .filter((branch) => !branch.archived)
    .map((branch) => ({ value: branch.id, label: branch.name }));
}

function InvitePanel({ open, onClose }: Readonly<{ open: boolean; onClose: () => void }>) {
  const me = useCurrentMember();
  const invite = useInvite();
  const branchOptions = useBranchOptions();
  const roles = invitableRoles(me.role);
  const error = toRequestErrorView(invite.error);

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    invite.mutate(
      {
        email: formText(form, 'email').trim(),
        role: formText(form, 'role') as 'manager' | 'staff',
        branchId: formText(form, 'branchId'),
      },
      { onSuccess: () => formElement.reset() },
    );
  }

  return (
    <SidePanel open={open} title="Invite to your team" onClose={onClose}>
      {branchOptions.length === 0 ? (
        <Alert tone="info">
          Create a branch first: managers and staff always work at a branch.
        </Alert>
      ) : (
        <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
          <RequestErrorAlert error={error} />
          {invite.isSuccess && (
            <Alert tone="success">
              Invitation sent to {invite.data.email}. The link is valid for 7 days.
            </Alert>
          )}
          <TextField label="Email" name="email" type="email" required error={error?.fields.email} />
          <Select
            label="Role"
            name="role"
            options={roles.map((role) => ({
              value: role,
              label: role === 'manager' ? 'Manager' : 'Staff (therapist)',
            }))}
            hint={
              me.role === 'manager'
                ? 'Managers can invite staff to their own branch.'
                : 'Each branch has at most one manager.'
            }
          />
          <Select
            label="Branch"
            name="branchId"
            options={branchOptions}
            error={error?.fields.branchId}
          />
          <Button type="submit" size="lg" disabled={invite.isPending}>
            {invite.isPending ? 'Sending…' : 'Send invitation'}
          </Button>
        </form>
      )}
    </SidePanel>
  );
}

/** Owner only: change role and/or branch; resolves a branch's current manager if needed. */
function ChangeMemberPanel({
  member,
  onClose,
}: Readonly<{ member: MemberRow; onClose: () => void }>) {
  const update = useUpdateMember();
  const branchOptions = useBranchOptions();
  const [needsDecision, setNeedsDecision] = useState(false);
  const error = toRequestErrorView(update.error);

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const decision = formText(form, 'currentManager');
    const moveTo = formText(form, 'moveTo');
    update.mutate(
      {
        id: member.id,
        change: {
          role: formText(form, 'role') as 'manager' | 'staff',
          branchId: formText(form, 'branchId'),
          ...(needsDecision &&
            decision && {
              currentManager:
                decision === 'move'
                  ? { action: 'move' as const, branchId: moveTo }
                  : { action: decision as 'demote' | 'deactivate' },
            }),
        },
      },
      {
        onSuccess: onClose,
        onError: (failure) => {
          if (toRequestErrorView(failure)?.code === 'BRANCH_HAS_MANAGER') setNeedsDecision(true);
        },
      },
    );
  }

  return (
    <SidePanel open title={`Change ${member.name}`} onClose={onClose}>
      <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
        <RequestErrorAlert error={error} />
        <Select
          label="Role"
          name="role"
          defaultValue={member.role}
          options={[
            { value: 'manager', label: 'Manager' },
            { value: 'staff', label: 'Staff (therapist)' },
          ]}
        />
        <Select
          label="Branch"
          name="branchId"
          defaultValue={member.branchId ?? undefined}
          options={branchOptions}
        />
        {needsDecision && (
          <fieldset className="m-0 flex flex-col gap-2 rounded-xl border border-border p-4">
            <legend className="px-1 text-sm font-semibold">
              What happens to the current manager?
            </legend>
            {[
              { value: 'demote', label: 'Becomes staff at the same branch' },
              { value: 'move', label: 'Moves to another branch as manager' },
              { value: 'deactivate', label: 'Is deactivated' },
            ].map((option) => (
              <label key={option.value} className="flex items-center gap-2.5 text-sm">
                <input
                  type="radio"
                  name="currentManager"
                  value={option.value}
                  required
                  className="size-4 accent-primary"
                />
                {option.label}
              </label>
            ))}
            <Select label="Move to (if moving)" name="moveTo" options={branchOptions} />
          </fieldset>
        )}
        <Button type="submit" size="lg" disabled={update.isPending}>
          {update.isPending ? 'Saving…' : 'Save changes'}
        </Button>
        <p className="text-[13px] text-muted">
          Changing someone&apos;s branch or demoting them logs them out so their new access applies
          at once.
        </p>
      </form>
    </SidePanel>
  );
}
