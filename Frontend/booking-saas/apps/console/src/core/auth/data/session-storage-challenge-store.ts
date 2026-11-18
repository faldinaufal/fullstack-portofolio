// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { CodeChallenge, PendingChallengeStore } from '../domain/auth';

const KEY = 'tempora.console.pending-challenge';

/**
 * Keeps the pending challenge in `sessionStorage`: it survives a reload of the verify page
 * but not closing the tab. Only the challenge ID and masked address are stored, never a
 * code. Storage can be unavailable (private mode, blocked site data), so every access is
 * guarded and the store degrades to "nothing pending".
 */
export function createSessionStorageChallengeStore(
  storage: () => Storage | undefined = () =>
    typeof window === 'undefined' ? undefined : window.sessionStorage,
): PendingChallengeStore {
  return {
    save(challenge) {
      try {
        storage()?.setItem(
          KEY,
          JSON.stringify({
            id: challenge.id,
            sentTo: challenge.sentTo,
            expiresAt: challenge.expiresAt.toISOString(),
            resendAvailableAt: challenge.resendAvailableAt.toISOString(),
          }),
        );
      } catch {
        // Storage full or blocked: the verify screen will send the user back to log in.
      }
    },

    load() {
      try {
        const raw = storage()?.getItem(KEY);
        if (!raw) return null;
        const value = JSON.parse(raw) as Record<string, unknown>;
        if (
          typeof value.id !== 'string' ||
          typeof value.sentTo !== 'string' ||
          typeof value.expiresAt !== 'string' ||
          typeof value.resendAvailableAt !== 'string'
        ) {
          return null;
        }
        return {
          id: value.id,
          sentTo: value.sentTo,
          expiresAt: new Date(value.expiresAt),
          resendAvailableAt: new Date(value.resendAvailableAt),
        } satisfies CodeChallenge;
      } catch {
        return null;
      }
    },

    clear() {
      try {
        storage()?.removeItem(KEY);
      } catch {
        // Nothing to clear.
      }
    },
  };
}
