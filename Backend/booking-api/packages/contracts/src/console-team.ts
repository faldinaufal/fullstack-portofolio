// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { z } from 'zod';
import { EmailSchema, MembershipRoleSchema, PersonNameSchema } from './console-auth.js';

const BranchRefSchema = z.object({ id: z.uuid(), name: z.string() });

export const MemberSchema = z
  .object({
    /** Membership ID: a person's role in this business. */
    id: z.uuid(),
    name: z.string(),
    email: z.string(),
    role: MembershipRoleSchema,
    branch: BranchRefSchema.nullable(),
    status: z.enum(['active', 'deactivated']),
    joinedAt: z.iso.datetime(),
  })
  .meta({ id: 'Member' });
export type Member = z.infer<typeof MemberSchema>;

export const MemberListSchema = z
  .object({ items: z.array(MemberSchema) })
  .meta({ id: 'MemberList' });
export type MemberList = z.infer<typeof MemberListSchema>;

/** Roles that can be given by invitation or role change; ownership has its own transfer flow. */
export const AssignableRoleSchema = z.enum(['manager', 'staff']);
export type AssignableRole = z.infer<typeof AssignableRoleSchema>;

export const InvitationSchema = z
  .object({
    id: z.uuid(),
    email: z.string(),
    role: MembershipRoleSchema,
    branch: BranchRefSchema.nullable(),
    status: z.enum(['pending', 'expired']),
    invitedBy: z.string().nullable(),
    createdAt: z.iso.datetime(),
    expiresAt: z.iso.datetime(),
  })
  .meta({ id: 'Invitation' });
export type Invitation = z.infer<typeof InvitationSchema>;

export const InvitationListSchema = z
  .object({ items: z.array(InvitationSchema) })
  .meta({ id: 'InvitationList' });
export type InvitationList = z.infer<typeof InvitationListSchema>;

export const CreateInvitationRequestSchema = z
  .object({
    email: EmailSchema,
    role: AssignableRoleSchema,
    branchId: z.uuid(),
  })
  .meta({ id: 'CreateInvitationRequest' });
export type CreateInvitationRequest = z.infer<typeof CreateInvitationRequestSchema>;

/**
 * What happens to the current manager when another member becomes manager of their branch
 * (FSD 6.8): demote to staff at the same branch, move to a branch without a manager, or
 * deactivate.
 */
export const CurrentManagerActionSchema = z
  .discriminatedUnion('action', [
    z.object({ action: z.literal('demote') }),
    z.object({ action: z.literal('move'), branchId: z.uuid() }),
    z.object({ action: z.literal('deactivate') }),
  ])
  .meta({ id: 'CurrentManagerAction' });
export type CurrentManagerAction = z.infer<typeof CurrentManagerActionSchema>;

export const UpdateMemberRequestSchema = z
  .object({
    role: AssignableRoleSchema.optional(),
    branchId: z.uuid().optional(),
    currentManager: CurrentManagerActionSchema.optional(),
  })
  .refine((body) => body.role !== undefined || body.branchId !== undefined, {
    message: 'Change the role, the branch or both.',
  })
  .meta({ id: 'UpdateMemberRequest' });
export type UpdateMemberRequest = z.infer<typeof UpdateMemberRequestSchema>;

/** `GET /invitations/:token`: shown before accepting, no login needed. */
export const InvitationPreviewSchema = z
  .object({
    businessName: z.string(),
    role: MembershipRoleSchema,
    branchName: z.string().nullable(),
    email: z.string(),
    /** True when the email already has a Console account: accept with its password. */
    accountExists: z.boolean(),
    expiresAt: z.iso.datetime(),
  })
  .meta({ id: 'InvitationPreview' });
export type InvitationPreview = z.infer<typeof InvitationPreviewSchema>;

export const AcceptInvitationRequestSchema = z
  .object({
    /** Required for a new account; ignored for an existing one. */
    name: PersonNameSchema.optional(),
    /**
     * New password for a new account (at least 12 characters, checked by the API), or the
     * current password of an existing account.
     */
    password: z.string().min(1).max(200),
  })
  .meta({ id: 'AcceptInvitationRequest' });
export type AcceptInvitationRequest = z.infer<typeof AcceptInvitationRequestSchema>;

export const SwitchMembershipRequestSchema = z
  .object({ membershipId: z.uuid() })
  .meta({ id: 'SwitchMembershipRequest' });
export type SwitchMembershipRequest = z.infer<typeof SwitchMembershipRequestSchema>;
