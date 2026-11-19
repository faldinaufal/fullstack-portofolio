// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { RequestError } from '../domain/request-error';

export interface RequestErrorView {
  code: string;
  message: string;
  fields: Record<string, string>;
  /** Request ID to quote, for unexpected errors only (FSD 8.5). */
  reference: string | undefined;
}

const GENERIC: Record<string, string> = {
  NETWORK_ERROR: 'Tempora cannot be reached. Check your connection and try again.',
  UNAUTHENTICATED: 'Your session has ended. Log in again.',
  RATE_LIMITED: 'Too many attempts. Wait a moment and try again.',
};

const UNEXPECTED = new Set(['UNEXPECTED', 'INTERNAL_ERROR', 'INVALID_RESPONSE']);

/** Message for a failed request; rule-specific codes keep the API's detail. */
export function toRequestErrorView(
  error: unknown,
  overrides: Partial<Record<string, string>> = {},
): RequestErrorView | null {
  if (!error) return null;
  const e =
    error instanceof RequestError ? error : new RequestError('UNEXPECTED', 'Something went wrong.');
  const unexpected = UNEXPECTED.has(e.code);
  return {
    code: e.code,
    message:
      overrides[e.code] ??
      GENERIC[e.code] ??
      (unexpected ? 'Something went wrong. Please try again.' : e.message),
    fields: Object.fromEntries(e.fields.map(({ field, message }) => [field, message])),
    reference: unexpected ? e.requestId : undefined,
  };
}
