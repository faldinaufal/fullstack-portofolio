// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { ApiError } from '@tempora/api-client';
import { describe, expect, it } from 'vitest';
import { AuthError } from '../domain/auth';
import { toAuthError, toCodeChallenge, toSession } from './auth.mapper';
import { createSessionStorageChallengeStore } from './session-storage-challenge-store';

describe('auth mapper', () => {
  it('converts the challenge and session contracts into domain objects', () => {
    const challenge = toCodeChallenge({
      status: 'otp_required',
      challengeId: 'fa1d0000-0000-4000-8000-000000000002',
      sentTo: 'i***@veloria.test',
      expiresAt: '2026-11-18T12:10:00.000Z',
      resendAvailableAt: '2026-11-18T12:01:00.000Z',
    });
    expect(challenge.expiresAt).toEqual(new Date('2026-11-18T12:10:00.000Z'));

    const membership = {
      id: 'fa1d0000-0000-4000-8000-000000000003',
      role: 'owner' as const,
      branchId: null,
      tenant: {
        id: 'fa1d0000-0000-4000-8000-000000000004',
        slug: 'lumen',
        name: 'Lumen',
        suspension: null,
      },
    };
    const session = toSession({
      account: {
        id: 'fa1d0000-0000-4000-8000-000000000005',
        email: 'maya@veloria.test',
        name: 'Maya Reyes',
      },
      activeMembership: membership,
      memberships: [membership],
    });
    expect(session.activeMembership.tenant.slug).toBe('lumen');
  });

  it('classifies API errors and keeps field errors and the request ID', () => {
    const error = toAuthError(
      new ApiError({
        status: 409,
        code: 'SLUG_TAKEN',
        message: 'Another business already uses this address.',
        requestId: 'req-7',
        fieldErrors: [{ path: 'slug', message: 'Already taken.' }],
      }),
    );
    expect(error).toBeInstanceOf(AuthError);
    expect(error.kind).toBe('slug-taken');
    expect(error.fields).toEqual([{ field: 'slug', message: 'Already taken.' }]);
    expect(error.requestId).toBe('req-7');

    expect(toAuthError(new ApiError({ status: 0, code: 'NETWORK_ERROR', message: 'x' })).kind).toBe(
      'unavailable',
    );
    expect(toAuthError(new TypeError('boom')).kind).toBe('unexpected');
  });
});

describe('session storage challenge store', () => {
  function fakeStorage(): Storage {
    const map = new Map<string, string>();
    return {
      get length() {
        return map.size;
      },
      clear: () => map.clear(),
      getItem: (key) => map.get(key) ?? null,
      key: (index) => [...map.keys()][index] ?? null,
      removeItem: (key) => void map.delete(key),
      setItem: (key, value) => void map.set(key, value),
    };
  }

  const challenge = {
    id: 'fa1d0000-0000-4000-8000-000000000006',
    sentTo: 'm***@veloria.test',
    expiresAt: new Date('2026-11-18T12:10:00.000Z'),
    resendAvailableAt: new Date('2026-11-18T12:01:00.000Z'),
  };

  it('saves, loads and clears a challenge', () => {
    const storage = fakeStorage();
    const store = createSessionStorageChallengeStore(() => storage);
    store.save(challenge);
    expect(store.load()).toEqual(challenge);
    store.clear();
    expect(store.load()).toBeNull();
  });

  it('treats corrupt data or missing storage as nothing pending', () => {
    const storage = fakeStorage();
    storage.setItem('tempora.console.pending-challenge', '{not json');
    expect(createSessionStorageChallengeStore(() => storage).load()).toBeNull();
    expect(createSessionStorageChallengeStore(() => undefined).load()).toBeNull();
  });
});
