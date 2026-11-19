// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { describe, expect, it } from 'vitest';
import { AuthError, type ConsoleSession } from '../domain/auth';
import { toErrorView } from './auth-messages';
import { validateNewPassword, validateSignup } from './password-forms';
import { toSessionViewModel } from './session.view-model';

describe('toErrorView', () => {
  it('uses a fixed message per kind and keeps field errors', () => {
    const view = toErrorView(
      new AuthError('email-taken', 'API detail', {
        fields: [{ field: 'email', message: 'Taken.' }],
      }),
    );
    expect(view?.message).toMatch(/already exists/);
    expect(view?.fields).toEqual({ email: 'Taken.' });
    expect(view?.requiresNewLogin).toBe(false);
  });

  it("keeps the API's detail where it carries specifics", () => {
    expect(toErrorView(new AuthError('code-invalid', '3 attempts left.'))?.message).toBe(
      '3 attempts left.',
    );
    expect(toErrorView(new AuthError('rate-limited', 'Try again in 45 seconds.'))?.message).toBe(
      'Try again in 45 seconds.',
    );
  });

  it('asks for a new login when the code expired, and shows a reference for unexpected errors', () => {
    expect(toErrorView(new AuthError('code-expired', 'x'))?.requiresNewLogin).toBe(true);
    expect(toErrorView(new AuthError('unexpected', 'x', { requestId: 'req-9' }))?.reference).toBe(
      'req-9',
    );
    expect(toErrorView(null)).toBeNull();
  });
});

describe('form validation', () => {
  const valid = {
    name: 'Maya Reyes',
    email: 'maya@veloria.test',
    password: 'correct horse battery',
    businessName: 'Lumen Wellness Studio',
    slug: 'lumen',
  };

  it('accepts a complete sign-up and flags each invalid field', () => {
    expect(validateSignup(valid)).toEqual({});
    expect(
      Object.keys(
        validateSignup({
          name: '',
          email: 'x',
          password: 'short',
          businessName: '',
          slug: 'Bad Slug',
        }),
      ),
    ).toEqual(['name', 'email', 'password', 'businessName', 'slug']);
  });

  it('requires matching new passwords of at least 12 characters', () => {
    expect(validateNewPassword('a long passphrase', 'a long passphrase')).toEqual({});
    expect(validateNewPassword('short', 'other')).toEqual({
      password: expect.any(String),
      confirmation: expect.any(String),
    });
  });
});

it('builds the shell view-model from the session', () => {
  const lumen = {
    id: 'm1',
    role: 'owner' as const,
    branchId: null,
    tenant: { id: 't1', slug: 'lumen', name: 'Lumen Wellness Studio', suspension: null },
  };
  const harbor = {
    id: 'm2',
    role: 'staff' as const,
    branchId: 'b1',
    tenant: { id: 't2', slug: 'harbor', name: 'Harbor Physio Clinic', suspension: null },
  };
  const session: ConsoleSession = {
    account: { id: 'a1', email: 'ines.halvorsen@veloria.test', name: 'Ines Halvorsen' },
    activeMembership: lumen,
    memberships: [lumen, harbor],
  };

  expect(toSessionViewModel(session)).toMatchObject({
    shortName: 'Ines H.',
    initials: 'IH',
    subtitle: 'Owner · All branches',
    tenantName: 'Lumen Wellness Studio',
    businesses: [
      { name: 'Lumen Wellness Studio', initial: 'L', active: true },
      { name: 'Harbor Physio Clinic', initial: 'H', active: false },
    ],
  });
});
