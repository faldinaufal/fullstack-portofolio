// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { ApiError } from '@tempora/api-client';
import type { ConsoleMeResponse, ConsoleMembership, OtpChallenge } from '@tempora/contracts';
import {
  AuthError,
  type AuthErrorKind,
  type CodeChallenge,
  type ConsoleSession,
  type Membership,
} from '../domain/auth';

export function toCodeChallenge(dto: OtpChallenge): CodeChallenge {
  return {
    id: dto.challengeId,
    sentTo: dto.sentTo,
    expiresAt: new Date(dto.expiresAt),
    resendAvailableAt: new Date(dto.resendAvailableAt),
  };
}

function toMembership(dto: ConsoleMembership): Membership {
  const { suspension } = dto.tenant;
  return {
    id: dto.id,
    role: dto.role,
    branchId: dto.branchId,
    tenant: {
      ...dto.tenant,
      suspension: suspension && { since: new Date(suspension.since), reason: suspension.reason },
    },
  };
}

export function toSession(dto: ConsoleMeResponse): ConsoleSession {
  return {
    account: { ...dto.account },
    activeMembership: toMembership(dto.activeMembership),
    memberships: dto.memberships.map(toMembership),
  };
}

const KIND_BY_CODE: Partial<Record<ApiError['code'], AuthErrorKind>> = {
  INVALID_CREDENTIALS: 'invalid-credentials',
  CODE_INVALID: 'code-invalid',
  CODE_EXPIRED: 'code-expired',
  TOKEN_INVALID: 'link-invalid',
  EMAIL_TAKEN: 'email-taken',
  SLUG_TAKEN: 'slug-taken',
  FORBIDDEN: 'no-business',
  RATE_LIMITED: 'rate-limited',
  VALIDATION_FAILED: 'invalid-input',
  NETWORK_ERROR: 'unavailable',
};

/** Classifies any failure of an auth request; the API's own message is kept as detail. */
export function toAuthError(error: unknown): AuthError {
  if (error instanceof AuthError) return error;
  if (!(error instanceof ApiError)) {
    return new AuthError('unexpected', 'Something went wrong.');
  }
  return new AuthError(KIND_BY_CODE[error.code] ?? 'unexpected', error.message, {
    fields: error.fieldErrors.map(({ path, message }) => ({ field: path, message })),
    requestId: error.requestId,
  });
}
