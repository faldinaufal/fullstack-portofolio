// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { AuthError, type AuthErrorKind } from '../domain/auth';

/** Screen-level message for every kind of auth failure (FSD 8.5: a message per code). */
const MESSAGES: Record<AuthErrorKind, string | null> = {
  'invalid-credentials': 'The email or password is incorrect.',
  'code-invalid': null, // the API's detail says how many attempts are left
  'code-expired': 'This code is no longer valid. Log in again to get a new one.',
  'link-invalid': 'This link is invalid, was already used or has expired. Request a new one.',
  'email-taken': 'An account with this email already exists. Log in instead.',
  'slug-taken': 'Another business already uses this address. Choose a different one.',
  'no-business': 'This account is not an active member of any business.',
  'rate-limited': null, // the API's detail says how long to wait
  'invalid-input': 'Some fields need attention.',
  unavailable: 'Tempora cannot be reached. Check your connection and try again.',
  unexpected: 'Something went wrong. Please try again.',
};

export interface ErrorView {
  message: string;
  /** Inline errors keyed by form field name. */
  fields: Record<string, string>;
  /** Request ID to quote to support, for unexpected errors only. */
  reference: string | undefined;
  /** The code step cannot continue; the user must log in again for a new code. */
  requiresNewLogin: boolean;
}

export function toErrorView(error: unknown): ErrorView | null {
  if (!error) return null;
  const authError =
    error instanceof AuthError ? error : new AuthError('unexpected', 'Something went wrong.');
  return {
    message: MESSAGES[authError.kind] ?? authError.message,
    fields: Object.fromEntries(authError.fields.map(({ field, message }) => [field, message])),
    reference: authError.kind === 'unexpected' ? authError.requestId : undefined,
    requiresNewLogin: authError.kind === 'code-expired',
  };
}
