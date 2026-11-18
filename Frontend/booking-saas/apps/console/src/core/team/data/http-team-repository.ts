// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { ApiClient } from '@tempora/api-client';
import {
  AcceptedResponseSchema,
  InvitationListSchema,
  InvitationPreviewSchema,
  InvitationSchema,
  MemberListSchema,
  MemberSchema,
  type Invitation as InvitationDto,
  type Member as MemberDto,
} from '@tempora/contracts';
import { z } from 'zod';
import { request } from '../../shared/data/to-request-error';
import type { Invitation, Member, TeamRepository } from '../domain/team';

const C = '/v1/console';

export const toMember = (dto: MemberDto): Member => ({
  ...dto,
  branch: dto.branch ? { ...dto.branch } : null,
  joinedAt: new Date(dto.joinedAt),
});

export const toInvitation = (dto: InvitationDto): Invitation => ({
  id: dto.id,
  email: dto.email,
  role: dto.role,
  branch: dto.branch ? { ...dto.branch } : null,
  status: dto.status,
  invitedBy: dto.invitedBy,
  expiresAt: new Date(dto.expiresAt),
});

export function createHttpTeamRepository(client: ApiClient): TeamRepository {
  return {
    listMembers: () =>
      request(async () =>
        (await client.get(`${C}/members`, { schema: MemberListSchema })).items.map(toMember),
      ),

    updateMember: (id, change) =>
      request(async () =>
        toMember(
          await client.request(`${C}/members/${id}`, {
            method: 'PATCH',
            schema: MemberSchema,
            body: change,
          }),
        ),
      ),

    deactivate: (id) =>
      request(async () =>
        toMember(await client.post(`${C}/members/${id}/deactivate`, { schema: MemberSchema })),
      ),

    reactivate: (id) =>
      request(async () =>
        toMember(await client.post(`${C}/members/${id}/reactivate`, { schema: MemberSchema })),
      ),

    listInvitations: () =>
      request(async () =>
        (await client.get(`${C}/invitations`, { schema: InvitationListSchema })).items.map(
          toInvitation,
        ),
      ),

    invite: (input) =>
      request(async () =>
        toInvitation(
          await client.post(`${C}/invitations`, { schema: InvitationSchema, body: input }),
        ),
      ),

    resendInvitation: (id) =>
      request(async () =>
        toInvitation(
          await client.post(`${C}/invitations/${id}/resend`, { schema: InvitationSchema }),
        ),
      ),

    revokeInvitation: (id) =>
      request(async () => {
        await client.request(`${C}/invitations/${id}`, { method: 'DELETE', schema: z.undefined() });
      }),

    previewInvitation: (token) =>
      request(async () => {
        const dto = await client.get(`${C}/invitation-links/${encodeURIComponent(token)}`, {
          schema: InvitationPreviewSchema,
        });
        return { ...dto, expiresAt: new Date(dto.expiresAt) };
      }),

    acceptInvitation: (token, input) =>
      request(async () => {
        await client.post(`${C}/invitation-links/${encodeURIComponent(token)}/accept`, {
          schema: AcceptedResponseSchema,
          body: input,
        });
      }),
  };
}
