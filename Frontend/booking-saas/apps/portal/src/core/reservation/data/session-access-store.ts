// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { BookingAccessStore } from '../domain/reservation';

const KEY = (id: string) => `tempora.booking-access.${id}`;

/**
 * Booking access tokens in `sessionStorage`: they last as long as the tab (the payment
 * redirect comes back to the same tab) and are not shared with other tabs or sites.
 * Storage can be unavailable (private mode, blocked site data); then the pages fall back to
 * the session or the emailed link.
 */
export function createSessionAccessStore(
  storage: () => Storage | undefined = () =>
    typeof window === 'undefined' ? undefined : window.sessionStorage,
): BookingAccessStore {
  return {
    get(id) {
      try {
        return storage()?.getItem(KEY(id)) ?? null;
      } catch {
        return null;
      }
    },
    save(id, token) {
      try {
        storage()?.setItem(KEY(id), token);
      } catch {
        // Nothing to do: see above.
      }
    },
  };
}
