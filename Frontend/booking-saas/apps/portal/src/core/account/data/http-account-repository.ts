// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { ApiError, type ApiClient } from '@tempora/api-client';
import {
  AcceptedResponseSchema,
  CustomerProfileSchema,
  SessionListSchema,
} from '@tempora/contracts';
import { z } from 'zod';
import { request, toRequestError } from '../../shared/data/to-request-error';
import type { AccountRepository } from '../domain/account';

const PT = '/v1/portal';
const NoContent = z.undefined();

/** `/v1/portal/auth/*` and `/v1/portal/me*` (FSD 5.3). */
export function createHttpAccountRepository(client: ApiClient): AccountRepository {
  return {
    async getCustomer() {
      try {
        return await client.get(`${PT}/me`, { schema: CustomerProfileSchema });
      } catch (error) {
        if (error instanceof ApiError && error.code === 'UNAUTHENTICATED') return null;
        throw toRequestError(error);
      }
    },

    signup: (input) =>
      request(() =>
        client.post(`${PT}/auth/signup`, { schema: CustomerProfileSchema, body: input }),
      ),

    login: (email, password) =>
      request(() =>
        client.post(`${PT}/auth/login`, {
          schema: CustomerProfileSchema,
          body: { email, password },
        }),
      ),

    logout: () =>
      request(async () => {
        await client.post(`${PT}/auth/logout`, { schema: NoContent });
      }),

    logoutEverywhere: () =>
      request(async () => {
        await client.post(`${PT}/auth/logout-all`, { schema: NoContent });
      }),

    verifyEmail: (token) =>
      request(() =>
        client.post(`${PT}/auth/verify-email`, { schema: CustomerProfileSchema, body: { token } }),
      ),

    resendVerification: () =>
      request(async () => {
        await client.post(`${PT}/me/verification-email`, { schema: AcceptedResponseSchema });
      }),

    requestPasswordReset: (email) =>
      request(async () => {
        await client.post(`${PT}/auth/forgot-password`, {
          schema: AcceptedResponseSchema,
          body: { email },
        });
      }),

    resetPassword: (token, password) =>
      request(async () => {
        await client.post(`${PT}/auth/reset-password`, {
          schema: AcceptedResponseSchema,
          body: { token, password },
        });
      }),

    updateProfile: (input) =>
      request(() =>
        client.request(`${PT}/me`, { method: 'PATCH', schema: CustomerProfileSchema, body: input }),
      ),

    changePassword: (currentPassword, newPassword) =>
      request(async () => {
        await client.post(`${PT}/me/password`, {
          schema: NoContent,
          body: { currentPassword, newPassword },
        });
      }),

    listSessions: () =>
      request(async () =>
        (await client.get(`${PT}/me/sessions`, { schema: SessionListSchema })).items.map((s) => ({
          id: s.id,
          device: s.device,
          lastSeenAt: new Date(s.lastSeenAt),
          current: s.current,
        })),
      ),

    revokeSession: (id) =>
      request(async () => {
        await client.request(`${PT}/me/sessions/${id}`, { method: 'DELETE', schema: NoContent });
      }),
  };
}
