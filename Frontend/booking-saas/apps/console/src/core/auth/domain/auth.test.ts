// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { describe, expect, it, vi } from 'vitest';
import type { AuthRepository, CodeChallenge, PendingChallengeStore } from './auth';
import { passwordProblem, scopeLabel, secondsUntil, slugFromBusinessName } from './auth-rules';
import { createAuthUseCases } from './auth-use-cases';

const challenge: CodeChallenge = {
  id: 'fa1d0000-0000-4000-8000-000000000001',
  sentTo: 'm***@veloria.test',
  expiresAt: new Date('2026-11-18T12:10:00Z'),
  resendAvailableAt: new Date('2026-11-18T12:01:00Z'),
};

function memoryStore(): PendingChallengeStore & { value: CodeChallenge | null } {
  return {
    value: null,
    save(next) {
      this.value = next;
    },
    load() {
      return this.value;
    },
    clear() {
      this.value = null;
    },
  };
}

function repository(overrides: Partial<AuthRepository> = {}): AuthRepository {
  return {
    getSession: vi.fn(async () => null),
    signup: vi.fn(async () => challenge),
    login: vi.fn(async () => ({ kind: 'code-required' as const, challenge })),
    verifyCode: vi.fn(async () => {}),
    resendCode: vi.fn(async () => challenge),
    logout: vi.fn(async () => {}),
    switchMembership: vi.fn(async () => {}),
    requestPasswordReset: vi.fn(async () => {}),
    resetPassword: vi.fn(async () => {}),
    ...overrides,
  };
}

describe('auth use cases', () => {
  it('remembers the challenge when a code is required and forgets it after verifying', async () => {
    const store = memoryStore();
    const auth = createAuthUseCases(repository(), store);

    await auth.login('maya@veloria.test', 'correct horse battery');
    expect(auth.pendingChallenge()).toEqual(challenge);

    await auth.verifyCode(challenge.id, '042170', false);
    expect(auth.pendingChallenge()).toBeNull();
  });

  it('keeps no challenge when a trusted device signs in directly', async () => {
    const store = memoryStore();
    store.save(challenge);
    const auth = createAuthUseCases(
      repository({ login: async () => ({ kind: 'signed-in' }) }),
      store,
    );

    await auth.login('maya@veloria.test', 'correct horse battery');
    expect(auth.pendingChallenge()).toBeNull();
  });

  it('keeps the challenge when the code is wrong, so the user can try again', async () => {
    const store = memoryStore();
    const auth = createAuthUseCases(
      repository({
        verifyCode: async () => {
          throw new Error('wrong code');
        },
      }),
      store,
    );
    await auth.signup({
      name: 'Maya Reyes',
      email: 'maya@veloria.test',
      password: 'correct horse battery',
      businessName: 'Lumen Wellness Studio',
      slug: 'lumen',
    });

    await expect(auth.verifyCode(challenge.id, '000000', false)).rejects.toThrow();
    expect(auth.pendingChallenge()).toEqual(challenge);
  });
});

describe('auth rules', () => {
  it('suggests a valid business address from the name', () => {
    expect(slugFromBusinessName('Lumen Wellness Studio')).toBe('lumen-wellness-studio');
    expect(slugFromBusinessName('  Café Ünique & Co.  ')).toBe('cafe-unique-co');
    expect(slugFromBusinessName('x'.repeat(39) + ' yz')).toBe('x'.repeat(39));
  });

  it('checks password length and that it does not contain the email', () => {
    expect(passwordProblem('short', 'maya@veloria.test')).toMatch(/12 characters/);
    expect(passwordProblem('maya forever and ever', 'maya@veloria.test')).toMatch(/email/);
    expect(passwordProblem('correct horse battery', 'maya@veloria.test')).toBeNull();
  });

  it('counts whole seconds down to zero', () => {
    const now = new Date('2026-11-18T12:00:00.000Z');
    expect(secondsUntil(new Date('2026-11-18T12:00:59.100Z'), now)).toBe(60);
    expect(secondsUntil(new Date('2026-11-18T11:59:00.000Z'), now)).toBe(0);
  });

  it('describes the scope of each role', () => {
    const tenant = { id: 't', slug: 'lumen', name: 'Lumen', suspension: null };
    expect(scopeLabel({ id: 'm', role: 'owner', branchId: null, tenant })).toBe('All branches');
    expect(scopeLabel({ id: 'm', role: 'manager', branchId: 'b', tenant })).toBe('Own branch');
    expect(scopeLabel({ id: 'm', role: 'staff', branchId: 'b', tenant })).toBe('Own schedule');
  });
});
