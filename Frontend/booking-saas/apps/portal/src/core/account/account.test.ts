// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { ApiError } from '@tempora/api-client';
import { describe, expect, it, vi } from 'vitest';
import { RequestError } from '../shared/domain/request-error';
import { createHttpAccountRepository } from './data/http-account-repository';
import { signupProblems } from './domain/account';

const valid = {
  name: 'Ines Halvorsen',
  email: 'ines.halvorsen@veloria.test',
  password: 'quiet river at dawn 4217',
};

describe('signupProblems', () => {
  it('accepts a valid sign-up, with or without phone', () => {
    expect(signupProblems(valid)).toEqual({});
    expect(signupProblems({ ...valid, phone: '+15550147001' })).toEqual({});
  });

  it('flags a short password, a password containing the email and a malformed phone', () => {
    expect(signupProblems({ ...valid, password: 'short' }).password).toMatch(/12 characters/);
    expect(signupProblems({ ...valid, password: 'ines.halvorsen rocks!' }).password).toMatch(
      /email/,
    );
    expect(signupProblems({ ...valid, phone: '555-0147' }).phone).toMatch(/international/);
  });
});

describe('account repository', () => {
  it('treats an expired or missing session as "nobody logged in", not as an error', async () => {
    const client = {
      get: vi.fn(async () => {
        throw new ApiError({ status: 401, code: 'UNAUTHENTICATED', message: 'Log in.' });
      }),
    };
    const repository = createHttpAccountRepository(client as never);
    await expect(repository.getCustomer()).resolves.toBeNull();
  });

  it('turns other failures into a RequestError with the API code', async () => {
    const client = {
      post: vi.fn(async () => {
        throw new ApiError({ status: 409, code: 'EMAIL_TAKEN', message: 'Taken.' });
      }),
    };
    const repository = createHttpAccountRepository(client as never);
    await expect(repository.signup(valid)).rejects.toEqual(expect.any(RequestError));
    await expect(repository.signup(valid)).rejects.toMatchObject({ code: 'EMAIL_TAKEN' });
  });
});
