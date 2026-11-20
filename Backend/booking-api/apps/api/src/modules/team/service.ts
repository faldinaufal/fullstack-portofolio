// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import {
  passwordContainsEmail,
  PASSWORD_MIN_LENGTH,
  type AcceptInvitationRequest,
  type CreateInvitationRequest,
  type CurrentManagerAction,
  type Invitation,
  type InvitationPreview,
  type Member,
  type UpdateMemberRequest,
} from '@tempora/contracts';
import { Prisma, setDbContext, withDbContext, type PrismaClient, type Tx } from '@tempora/db';
import { AppError } from '../../lib/app-error.js';
import { recordAudit } from '../../lib/audit.js';
import { activeBookings, assertNoConflicts } from '../bookings/active.js';
import { lockTherapists } from '../bookings/rules.js';
import type { PasswordHasher } from '../../lib/passwords.js';
import { RATE_LIMITS, type RateLimiter } from '../../lib/rate-limit.js';
import { generateToken, type TokenHasher } from '../../lib/tokens.js';
import { auditActor } from '../branches/service.js';
import {
  canInvite,
  canManageMember,
  canSeeBranch,
  canSeeMember,
  forbidden,
  notFound,
} from '../console-auth/access.js';
import type { ConsoleActor } from '../console-auth/guard.js';
import type { RequestMeta } from '../console-auth/service.js';
import { teamRepository as repo, type InvitationRow, type MemberRow } from './repository.js';

const DAY = 24 * 60 * 60_000;
export const INVITATION_TTL_DAYS = 7;

export function toMember(row: MemberRow): Member {
  return {
    id: row.id,
    name: row.teamAccount.name,
    email: row.teamAccount.email,
    role: row.role,
    branch: row.branch ? { id: row.branch.id, name: row.branch.name } : null,
    status: row.status,
    joinedAt: row.createdAt.toISOString(),
  };
}

export function toInvitation(row: InvitationRow, now: Date): Invitation {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    branch: row.branch ? { id: row.branch.id, name: row.branch.name } : null,
    status: row.expiresAt > now ? 'pending' : 'expired',
    invitedBy: row.invitedBy?.teamAccount.name ?? null,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
  };
}

const branchHasManager = (name: string) =>
  new AppError({
    status: 409,
    code: 'BRANCH_HAS_MANAGER',
    title: 'Branch already has a manager',
    detail: `${name} already manages this branch. Choose what happens to them (demote, move or deactivate).`,
  });

const invitationExpired = () =>
  new AppError({
    status: 410,
    code: 'INVITATION_EXPIRED',
    title: 'Invitation no longer valid',
    detail: 'This invitation has expired, was revoked or was already used. Ask for a new one.',
  });

const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

export interface TeamServiceDeps {
  prisma: PrismaClient;
  passwords: PasswordHasher;
  hashToken: TokenHasher;
  rateLimiter: RateLimiter;
  consoleUrl: string;
  now?: () => Date;
}

/** Members and invitations (FSD 1.2 Team, 3.6, 5.4 Team, 6.8, 7.4). */
export function createTeamService({
  prisma,
  passwords,
  hashToken,
  rateLimiter,
  consoleUrl,
  now = () => new Date(),
}: TeamServiceDeps) {
  const inTenant = <T>(actor: ConsoleActor, work: (tx: Tx) => Promise<T>) =>
    withDbContext(prisma, { tenantId: actor.tenantId, teamAccountId: actor.teamAccountId }, work);

  async function visibleMember(tx: Tx, actor: ConsoleActor, id: string) {
    const member = await repo.findMember(tx, actor.tenantId, id);
    if (!member || !canSeeMember(actor, member)) throw notFound('Member');
    return member;
  }

  async function usableBranch(tx: Tx, actor: ConsoleActor, id: string) {
    const branch = await repo.findBranch(tx, actor.tenantId, id);
    if (!branch || !canSeeBranch(actor, id)) throw notFound('Branch');
    if (branch.archivedAt) {
      throw new AppError({
        status: 409,
        code: 'VALIDATION_FAILED',
        title: 'Branch archived',
        detail: 'Choose a branch that is not archived.',
        errors: [{ path: 'branchId', message: 'This branch is archived.' }],
      });
    }
    return branch;
  }

  /** Ends the member's Console sessions in this tenant: changes apply on the next request. */
  async function endSessions(tx: Tx, member: MemberRow, alsoDevices: boolean) {
    await repo.revokeMembershipSessions(tx, member.id, now());
    if (alsoDevices) await repo.revokeTrustedDevices(tx, member.teamAccount.id, now());
  }

  async function sendInvitationEmail(
    tx: Tx,
    actor: ConsoleActor,
    invitation: {
      email: string;
      role: Invitation['role'];
      branchId: string | null;
      branchName: string | null;
    },
    token: string,
  ) {
    const tenant = await tx.tenant.findUniqueOrThrow({ where: { id: actor.tenantId } });
    const acceptUrl = new URL(`/invite/${token}`, consoleUrl).toString();
    await tx.emailMessage.createMany({
      data: [
        {
          tenantId: actor.tenantId,
          // A staff invitation belongs to its branch's email log; a manager's (sent by the
          // owner) stays out of other managers' view, like in the audit log (FSD 1.2).
          branchId: invitation.role === 'staff' ? invitation.branchId : null,
          toEmail: invitation.email,
          template: 'console.invitation',
          payload: {
            businessName: tenant.name,
            inviterName: actor.accountName,
            role: invitation.role,
            branchName: invitation.branchName,
            acceptUrl,
            expiresInDays: INVITATION_TTL_DAYS,
          },
        },
      ],
    });
  }

  /**
   * Applies the chosen action to the branch's current manager before someone else takes the
   * role (FSD 6.8). Order matters: the partial unique index allows one active manager per
   * branch at every moment, so the old manager steps down first.
   */
  /** FSD 6.8: a therapist leaving their branch (or the team) must not strand bookings. */
  async function assertNoBookingsOf(tx: Tx, member: { id: string }, detail: string) {
    await lockTherapists(tx, [member.id]);
    assertNoConflicts(await activeBookings(tx, { staffMembershipId: member.id }, now()), detail);
  }

  async function resolveCurrentManager(
    tx: Tx,
    actor: ConsoleActor,
    current: MemberRow,
    action: CurrentManagerAction,
    takenBranchId: string,
  ) {
    let after: MemberRow;
    if (action.action === 'demote') {
      after = await repo.updateMember(tx, current.id, { role: 'staff' });
    } else if (action.action === 'move') {
      if (action.branchId === takenBranchId) throw branchHasManager(current.teamAccount.name);
      await assertNoBookingsOf(tx, current, `${current.teamAccount.name} has upcoming bookings.`);
      await usableBranch(tx, actor, action.branchId);
      const other = await repo.activeManagerOf(tx, action.branchId);
      if (other) throw branchHasManager(other.teamAccount.name);
      after = await repo.updateMember(tx, current.id, { branchId: action.branchId });
    } else {
      await assertNoBookingsOf(tx, current, `${current.teamAccount.name} has upcoming bookings.`);
      after = await repo.updateMember(tx, current.id, { status: 'deactivated' });
    }
    await endSessions(tx, current, action.action === 'deactivate');
    await recordAudit(tx, auditActor(actor), {
      tenantId: actor.tenantId,
      branchId: current.branchId,
      action: action.action === 'deactivate' ? 'membership.deactivated' : 'membership.updated',
      entityType: 'membership',
      entityId: current.id,
      before: toMember(current),
      after: toMember(after),
      reason: 'Replaced as branch manager',
    });
  }

  return {
    // --- members ------------------------------------------------------------
    /** Owner: everyone. Manager: members of their branch. */
    listMembers: (actor: ConsoleActor) =>
      inTenant(actor, async (tx) => {
        const rows = await repo.listMembers(
          tx,
          actor.tenantId,
          actor.role === 'owner' ? undefined : (actor.branchId ?? undefined),
        );
        return { items: rows.map(toMember) };
      }),

    getMember: (actor: ConsoleActor, id: string) =>
      inTenant(actor, async (tx) => toMember(await visibleMember(tx, actor, id))),

    /** Owner: change role and/or branch of a manager or staff member. */
    updateMember: (actor: ConsoleActor, id: string, input: UpdateMemberRequest) =>
      inTenant(actor, async (tx) => {
        const member = await visibleMember(tx, actor, id);
        if (!canManageMember(actor, member)) {
          throw forbidden('The owner can only be changed through an ownership transfer.');
        }
        if (member.status !== 'active') {
          throw new AppError({
            status: 409,
            code: 'VALIDATION_FAILED',
            title: 'Member deactivated',
            detail: 'Reactivate the member before changing their role or branch.',
          });
        }
        const role = input.role ?? member.role;
        const branchId = input.branchId ?? member.branchId;
        if (!branchId) throw notFound('Branch');
        if (input.branchId) await usableBranch(tx, actor, input.branchId);
        if (branchId !== member.branchId) {
          await assertNoBookingsOf(tx, member, 'The member has upcoming bookings at their branch.');
        }

        if (role === 'manager') {
          const current = await repo.activeManagerOf(tx, branchId);
          if (current && current.id !== member.id) {
            if (!input.currentManager) throw branchHasManager(current.teamAccount.name);
            await resolveCurrentManager(tx, actor, current, input.currentManager, branchId);
          }
        }

        try {
          const updated = await repo.updateMember(tx, id, { role, branchId });
          const demoted = member.role === 'manager' && role === 'staff';
          if (demoted || branchId !== member.branchId) await endSessions(tx, member, false);
          await recordAudit(tx, auditActor(actor), {
            tenantId: actor.tenantId,
            branchId,
            action: 'membership.updated',
            entityType: 'membership',
            entityId: id,
            before: toMember(member),
            after: toMember(updated),
          });
          return toMember(updated);
        } catch (error) {
          // Two requests appointing managers at once: the database keeps one per branch.
          if (isUniqueViolation(error)) throw branchHasManager('Someone else');
          throw error;
        }
      }),

    /** Ends access immediately: sessions and trusted devices are revoked (FSD 6.8, 6.11). */
    deactivate: (actor: ConsoleActor, id: string) =>
      inTenant(actor, async (tx) => {
        const member = await visibleMember(tx, actor, id);
        if (!canManageMember(actor, member)) throw forbidden('You cannot deactivate this member.');
        if (member.status === 'deactivated') return toMember(member);
        await assertNoBookingsOf(tx, member, 'The member has upcoming bookings.');
        const updated = await repo.updateMember(tx, id, { status: 'deactivated' });
        await endSessions(tx, member, true);
        await recordAudit(tx, auditActor(actor), {
          tenantId: actor.tenantId,
          branchId: member.branchId,
          action: 'membership.deactivated',
          entityType: 'membership',
          entityId: id,
          before: toMember(member),
          after: toMember(updated),
        });
        return toMember(updated);
      }),

    reactivate: (actor: ConsoleActor, id: string) =>
      inTenant(actor, async (tx) => {
        const member = await visibleMember(tx, actor, id);
        if (!canManageMember(actor, member)) throw forbidden('You cannot reactivate this member.');
        if (member.status === 'active') return toMember(member);
        if (member.branch?.archivedAt) {
          throw new AppError({
            status: 409,
            code: 'VALIDATION_FAILED',
            title: 'Branch archived',
            detail: 'Their branch is archived. Move them to another branch after reactivating.',
          });
        }
        if (member.role === 'manager' && member.branchId) {
          const current = await repo.activeManagerOf(tx, member.branchId);
          if (current) throw branchHasManager(current.teamAccount.name);
        }
        try {
          const updated = await repo.updateMember(tx, id, { status: 'active' });
          await recordAudit(tx, auditActor(actor), {
            tenantId: actor.tenantId,
            branchId: member.branchId,
            action: 'membership.reactivated',
            entityType: 'membership',
            entityId: id,
            before: toMember(member),
            after: toMember(updated),
          });
          return toMember(updated);
        } catch (error) {
          if (isUniqueViolation(error)) throw branchHasManager('Someone else');
          throw error;
        }
      }),

    // --- invitations --------------------------------------------------------
    listInvitations: (actor: ConsoleActor) =>
      inTenant(actor, async (tx) => {
        const rows = await repo.listOpenInvitations(
          tx,
          actor.tenantId,
          actor.role === 'owner' ? undefined : (actor.branchId ?? undefined),
        );
        return { items: rows.map((row) => toInvitation(row, now())) };
      }),

    invite: (actor: ConsoleActor, input: CreateInvitationRequest) =>
      inTenant(actor, async (tx) => {
        if (!canInvite(actor, input.role, input.branchId)) {
          throw forbidden(
            actor.role === 'manager'
              ? 'Managers can invite staff to their own branch only.'
              : 'Your role cannot invite members.',
          );
        }
        const branch = await usableBranch(tx, actor, input.branchId);

        const account = await repo.findAccountByEmail(tx, input.email);
        if (account && (await repo.findMemberByAccount(tx, actor.tenantId, account.id))) {
          throw new AppError({
            status: 409,
            code: 'ALREADY_MEMBER',
            title: 'Already a member',
            detail: 'This person is already a member of your business (reactivate them if needed).',
            errors: [{ path: 'email', message: 'Already a member.' }],
          });
        }
        if (await repo.findOpenInvitationForEmail(tx, actor.tenantId, input.email)) {
          throw new AppError({
            status: 409,
            code: 'INVITATION_PENDING',
            title: 'Already invited',
            detail: 'This email already has an open invitation. Resend or revoke it instead.',
            errors: [{ path: 'email', message: 'Already invited.' }],
          });
        }
        if (input.role === 'manager') {
          const current = await repo.activeManagerOf(tx, branch.id);
          if (current) throw branchHasManager(current.teamAccount.name);
        }

        const token = generateToken();
        let invitation: InvitationRow;
        try {
          invitation = await repo.createInvitation(tx, {
            tenantId: actor.tenantId,
            email: input.email,
            role: input.role,
            branchId: branch.id,
            tokenHash: hashToken('invitation', token),
            invitedByMembershipId: actor.membershipId,
            now: now(),
            expiresAt: new Date(now().getTime() + INVITATION_TTL_DAYS * DAY),
          });
        } catch (error) {
          if (isUniqueViolation(error)) {
            throw new AppError({
              status: 409,
              code: 'INVITATION_PENDING',
              title: 'Already invited',
              detail: 'This email already has an open invitation.',
            });
          }
          throw error;
        }
        await sendInvitationEmail(
          tx,
          actor,
          { email: input.email, role: input.role, branchId: branch.id, branchName: branch.name },
          token,
        );
        const dto = toInvitation(invitation, now());
        await recordAudit(tx, auditActor(actor), {
          tenantId: actor.tenantId,
          branchId: branch.id,
          action: 'invitation.created',
          entityType: 'invitation',
          entityId: invitation.id,
          after: dto,
        });
        return dto;
      }),

    /** New token and a fresh 7 days; the old link stops working (FSD 7.4). */
    resendInvitation: (actor: ConsoleActor, id: string) =>
      inTenant(actor, async (tx) => {
        const invitation = await repo.findInvitation(tx, actor.tenantId, id);
        if (
          !invitation ||
          invitation.acceptedAt ||
          invitation.revokedAt ||
          (invitation.branchId && !canSeeBranch(actor, invitation.branchId))
        ) {
          throw notFound('Invitation');
        }
        const token = generateToken();
        const renewed = await repo.renewInvitation(tx, id, {
          tokenHash: hashToken('invitation', token),
          expiresAt: new Date(now().getTime() + INVITATION_TTL_DAYS * DAY),
        });
        await sendInvitationEmail(
          tx,
          actor,
          {
            email: renewed.email,
            role: renewed.role,
            branchId: renewed.branchId,
            branchName: renewed.branch?.name ?? null,
          },
          token,
        );
        const dto = toInvitation(renewed, now());
        await recordAudit(tx, auditActor(actor), {
          tenantId: actor.tenantId,
          branchId: renewed.branchId,
          action: 'invitation.resent',
          entityType: 'invitation',
          entityId: id,
          before: toInvitation(invitation, now()),
          after: dto,
        });
        return dto;
      }),

    revokeInvitation: (actor: ConsoleActor, id: string) =>
      inTenant(actor, async (tx) => {
        const invitation = await repo.findInvitation(tx, actor.tenantId, id);
        if (
          !invitation ||
          invitation.acceptedAt ||
          invitation.revokedAt ||
          (invitation.branchId && !canSeeBranch(actor, invitation.branchId))
        ) {
          throw notFound('Invitation');
        }
        await repo.revokeInvitation(tx, id, now());
        await recordAudit(tx, auditActor(actor), {
          tenantId: actor.tenantId,
          branchId: invitation.branchId,
          action: 'invitation.revoked',
          entityType: 'invitation',
          entityId: id,
          before: toInvitation(invitation, now()),
        });
      }),

    /** `GET /invitations/:token`: what the invitee sees before accepting. No login. */
    previewInvitation: (token: string): Promise<InvitationPreview> => {
      const tokenHash = hashToken('invitation', token);
      return withDbContext(prisma, { invitationTokenHash: tokenHash }, async (tx) => {
        const invitation = await repo.findInvitationByToken(tx, tokenHash);
        if (
          !invitation ||
          invitation.acceptedAt ||
          invitation.revokedAt ||
          invitation.expiresAt <= now() ||
          invitation.tenant.archivedAt
        ) {
          throw invitationExpired();
        }
        // Found through the token: continue inside that tenant's context.
        await setDbContext(tx, { tenantId: invitation.tenantId, invitationTokenHash: tokenHash });
        const branch = invitation.branchId
          ? await repo.findBranch(tx, invitation.tenantId, invitation.branchId)
          : null;
        return {
          businessName: invitation.tenant.name,
          role: invitation.role,
          branchName: branch?.name ?? null,
          email: invitation.email,
          accountExists: (await repo.findAccountByEmail(tx, invitation.email)) !== null,
          expiresAt: invitation.expiresAt.toISOString(),
        };
      });
    },

    /**
     * Joins the tenant. A new person sets name and password (the link proves the email);
     * someone with a Console account confirms with their password (FSD 3.6). They log in
     * normally afterwards, with the usual email code.
     */
    async acceptInvitation(
      token: string,
      input: AcceptInvitationRequest,
      meta: RequestMeta,
    ): Promise<void> {
      const tokenHash = hashToken('invitation', token);
      const found = await withDbContext(prisma, { invitationTokenHash: tokenHash }, async (tx) => {
        const invitation = await repo.findInvitationByToken(tx, tokenHash);
        if (
          !invitation ||
          invitation.acceptedAt ||
          invitation.revokedAt ||
          invitation.expiresAt <= now() ||
          invitation.tenant.archivedAt
        ) {
          return null;
        }
        return { invitation, account: await repo.findAccountByEmail(tx, invitation.email) };
      });
      if (!found) throw invitationExpired();
      const { invitation, account } = found;

      let passwordHash: string | undefined;
      if (account) {
        const limitKey = `${account.email}\n${meta.ip}`;
        await rateLimiter.assertAllowed(RATE_LIMITS.consoleLoginFailure, limitKey);
        if (!(await passwords.verify(account.passwordHash, input.password))) {
          await rateLimiter.record(RATE_LIMITS.consoleLoginFailure, limitKey);
          throw new AppError({
            status: 401,
            code: 'INVALID_CREDENTIALS',
            title: 'Wrong password',
            detail: 'Enter the password of your existing Tempora Console account.',
            errors: [{ path: 'password', message: 'Wrong password.' }],
          });
        }
      } else {
        const problems: { path: string; message: string }[] = [];
        if (!input.name) problems.push({ path: 'name', message: 'Enter your name.' });
        if (input.password.length < PASSWORD_MIN_LENGTH) {
          problems.push({
            path: 'password',
            message: `Use at least ${PASSWORD_MIN_LENGTH} characters.`,
          });
        } else if (passwordContainsEmail(input.password, invitation.email)) {
          problems.push({ path: 'password', message: 'Must not contain your email address.' });
        }
        if (problems.length > 0) {
          throw new AppError({
            status: 400,
            code: 'VALIDATION_FAILED',
            title: 'Invalid request',
            detail: 'Some fields need attention.',
            errors: problems,
          });
        }
        passwordHash = await passwords.hash(input.password);
      }

      try {
        await withDbContext(
          prisma,
          { tenantId: invitation.tenantId, invitationTokenHash: tokenHash },
          async (tx) => {
            if (!(await repo.markAccepted(tx, invitation.id, now()))) throw invitationExpired();
            const joining =
              account ??
              (await repo.createAccount(tx, {
                email: invitation.email,
                name: input.name ?? '',
                passwordHash: passwordHash ?? '',
                now: now(),
              }));
            if (await repo.findMemberByAccount(tx, invitation.tenantId, joining.id)) {
              throw new AppError({
                status: 409,
                code: 'ALREADY_MEMBER',
                title: 'Already a member',
                detail: 'You are already a member of this business. Log in instead.',
              });
            }
            const membership = await repo.createMembership(tx, {
              tenantId: invitation.tenantId,
              teamAccountId: joining.id,
              role: invitation.role,
              branchId: invitation.branchId,
            });
            await recordAudit(
              tx,
              { type: 'team_member', id: membership.id, label: joining.name, ip: meta.ip },
              {
                tenantId: invitation.tenantId,
                branchId: invitation.branchId,
                action: 'invitation.accepted',
                entityType: 'membership',
                entityId: membership.id,
                after: {
                  role: membership.role,
                  branchId: membership.branchId,
                  email: joining.email,
                },
              },
            );
          },
        );
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new AppError({
            status: 409,
            code: 'BRANCH_HAS_MANAGER',
            title: 'Branch already has a manager',
            detail: 'This branch got a manager after you were invited. Ask for a new invitation.',
          });
        }
        throw error;
      }
    },
  };
}

export type TeamService = ReturnType<typeof createTeamService>;
