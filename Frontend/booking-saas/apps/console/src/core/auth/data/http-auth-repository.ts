// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { ApiError, type ApiClient } from '@tempora/api-client';
import {
  AcceptedResponseSchema,
  AuthenticatedSchema,
  ConsoleLoginResponseSchema,
  ConsoleMeResponseSchema,
  OtpChallengeSchema,
} from '@tempora/contracts';
import { z } from 'zod';
import type { AuthRepository } from '../domain/auth';
import { toAuthError, toCodeChallenge, toSession } from './auth.mapper';

const BASE = '/v1/console';
const NoContent = z.undefined();

/** Runs a request and converts any failure into a domain `AuthError`. */
async function guard<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    throw toAuthError(error);
  }
}

/** `AuthRepository` over the Tempora API (`/v1/console/auth/*`, `/v1/console/me`). */
export function createHttpAuthRepository(client: ApiClient): AuthRepository {
  return {
    async getSession() {
      try {
        return toSession(await client.get(`${BASE}/me`, { schema: ConsoleMeResponseSchema }));
      } catch (error) {
        if (error instanceof ApiError && error.code === 'UNAUTHENTICATED') return null;
        throw toAuthError(error);
      }
    },

    signup: (input) =>
      guard(async () =>
        toCodeChallenge(
          await client.post(`${BASE}/auth/signup`, { schema: OtpChallengeSchema, body: input }),
        ),
      ),

    login: (email, password) =>
      guard(async () => {
        const response = await client.post(`${BASE}/auth/login`, {
          schema: ConsoleLoginResponseSchema,
          body: { email, password },
        });
        return response.status === 'authenticated'
          ? { kind: 'signed-in' as const }
          : { kind: 'code-required' as const, challenge: toCodeChallenge(response) };
      }),

    verifyCode: (challengeId, code, trustDevice) =>
      guard(async () => {
        await client.post(`${BASE}/auth/verify-otp`, {
          schema: AuthenticatedSchema,
          body: { challengeId, code, trustDevice },
        });
      }),

    resendCode: (challengeId) =>
      guard(async () =>
        toCodeChallenge(
          await client.post(`${BASE}/auth/resend-otp`, {
            schema: OtpChallengeSchema,
            body: { challengeId },
          }),
        ),
      ),

    logout: () =>
      guard(async () => {
        await client.post(`${BASE}/auth/logout`, { schema: NoContent });
      }),

    switchMembership: (membershipId) =>
      guard(async () => {
        await client.post(`${BASE}/me/active-membership`, {
          schema: AuthenticatedSchema,
          body: { membershipId },
        });
      }),

    requestPasswordReset: (email) =>
      guard(async () => {
        await client.post(`${BASE}/auth/forgot-password`, {
          schema: AcceptedResponseSchema,
          body: { email },
        });
      }),

    resetPassword: (token, password) =>
      guard(async () => {
        await client.post(`${BASE}/auth/reset-password`, {
          schema: AcceptedResponseSchema,
          body: { token, password },
        });
      }),
  };
}
