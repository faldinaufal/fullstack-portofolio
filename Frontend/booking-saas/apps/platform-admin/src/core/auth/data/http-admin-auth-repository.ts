// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { ApiError, type ApiClient } from '@tempora/api-client';
import {
  AdminMeSchema,
  OtpChallengeSchema,
  type AdminMe,
  type OtpChallenge,
} from '@tempora/contracts';
import { z } from 'zod';
import { request, toRequestError } from '../../shared/data/to-request-error';
import type { Admin, AdminAuthRepository, CodeChallenge } from '../domain/admin-auth';

const A = '/v1/admin';
const NoContent = z.null();

export const toAdmin = (dto: AdminMe): Admin => ({
  ...dto,
  stepUpValidUntil: dto.stepUpValidUntil ? new Date(dto.stepUpValidUntil) : null,
});

export const toChallenge = (dto: OtpChallenge): CodeChallenge => ({
  id: dto.challengeId,
  sentTo: dto.sentTo,
  expiresAt: new Date(dto.expiresAt),
  resendAvailableAt: new Date(dto.resendAvailableAt),
});

/** `/v1/admin/auth/*` and `/v1/admin/me` (FSD 5.5). */
export function createHttpAdminAuthRepository(client: ApiClient): AdminAuthRepository {
  return {
    async me() {
      try {
        return toAdmin(await client.get(`${A}/me`, { schema: AdminMeSchema }));
      } catch (error) {
        if (error instanceof ApiError && error.code === 'UNAUTHENTICATED') return null;
        throw toRequestError(error);
      }
    },
    login: (email, password) =>
      request(async () =>
        toChallenge(
          await client.post(`${A}/auth/login`, {
            schema: OtpChallengeSchema,
            body: { email, password },
          }),
        ),
      ),
    verify: (challengeId, code) =>
      request(async () => {
        await client.post(`${A}/auth/verify-otp`, {
          schema: NoContent,
          body: { challengeId, code },
        });
      }),
    resend: (challengeId) =>
      request(async () =>
        toChallenge(
          await client.post(`${A}/auth/resend-otp`, {
            schema: OtpChallengeSchema,
            body: { challengeId },
          }),
        ),
      ),
    logout: () =>
      request(async () => {
        await client.post(`${A}/auth/logout`, { schema: NoContent });
      }),
    startStepUp: () =>
      request(async () =>
        toChallenge(await client.post(`${A}/auth/step-up`, { schema: OtpChallengeSchema })),
      ),
    verifyStepUp: (challengeId, code) =>
      request(async () =>
        toAdmin(
          await client.post(`${A}/auth/step-up/verify`, {
            schema: AdminMeSchema,
            body: { challengeId, code },
          }),
        ),
      ),
  };
}
