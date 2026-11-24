// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { ApiClient } from '@tempora/api-client';
import {
  AcceptedResponseSchema,
  ImageUploadSchema,
  InvitationListSchema,
  InvitationPreviewSchema,
  InvitationSchema,
  MemberDetailSchema,
  MemberListSchema,
  MemberSchema,
  TimeOffSchema,
  type MemberDetail as MemberDetailDto,
  type TimeOff as TimeOffDto,
  type Invitation as InvitationDto,
  type Member as MemberDto,
} from '@tempora/contracts';
import { z } from 'zod';
import { putToStorage } from '../../shared/data/direct-upload';
import { request } from '../../shared/data/to-request-error';
import type { Invitation, Member, MemberDetail, TeamRepository, TimeOff } from '../domain/team';

const C = '/v1/console';

export const toMember = (dto: MemberDto): Member => ({
  ...dto,
  branch: dto.branch ? { ...dto.branch } : null,
  joinedAt: new Date(dto.joinedAt),
});

const toTimeOff = (dto: TimeOffDto): TimeOff => ({
  id: dto.id,
  startsAt: new Date(dto.startsAt),
  endsAt: new Date(dto.endsAt),
  reason: dto.reason,
});

export const toMemberDetail = (dto: MemberDetailDto): MemberDetail => ({
  ...toMember(dto),
  photoUrl: dto.photoUrl,
  workingHours: dto.workingHours.map((h) => ({ ...h })),
  services: dto.services.map((s) => ({ ...s })),
  timeOff: dto.timeOff.map(toTimeOff),
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

    getMember: (id) =>
      request(async () =>
        toMemberDetail(await client.get(`${C}/members/${id}`, { schema: MemberDetailSchema })),
      ),

    /** Sign, upload straight to storage, then confirm (FSD 6.15). */
    uploadPhoto: (id, file) =>
      request(async () => {
        const upload = await client.post(`${C}/members/${id}/photo/upload-url`, {
          schema: ImageUploadSchema,
          body: { contentType: file.type, sizeBytes: file.size },
        });
        await putToStorage(upload, file);
        return toMemberDetail(
          await client.request(`${C}/members/${id}/photo`, {
            method: 'PUT',
            schema: MemberDetailSchema,
            body: { key: upload.key },
          }),
        );
      }),

    removePhoto: (id) =>
      request(async () =>
        toMemberDetail(
          await client.request(`${C}/members/${id}/photo`, {
            method: 'DELETE',
            schema: MemberDetailSchema,
          }),
        ),
      ),

    replaceWorkingHours: (id, hours) =>
      request(async () =>
        toMemberDetail(
          await client.request(`${C}/members/${id}/working-hours`, {
            method: 'PUT',
            schema: MemberDetailSchema,
            body: { hours },
          }),
        ),
      ),

    replaceServices: (id, serviceIds) =>
      request(async () =>
        toMemberDetail(
          await client.request(`${C}/members/${id}/services`, {
            method: 'PUT',
            schema: MemberDetailSchema,
            body: { serviceIds },
          }),
        ),
      ),

    addTimeOff: (id, input) =>
      request(async () =>
        toTimeOff(
          await client.post(`${C}/members/${id}/time-off`, {
            schema: TimeOffSchema,
            body: {
              startsAt: input.startsAt.toISOString(),
              endsAt: input.endsAt.toISOString(),
              ...(input.reason && { reason: input.reason }),
            },
          }),
        ),
      ),

    removeTimeOff: (id, timeOffId) =>
      request(async () => {
        await client.request(`${C}/members/${id}/time-off/${timeOffId}`, {
          method: 'DELETE',
          schema: z.undefined(),
        });
      }),

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
