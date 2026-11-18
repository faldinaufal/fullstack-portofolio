// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type {
  AuthRepository,
  CodeChallenge,
  LoginOutcome,
  PendingChallengeStore,
  SignupInput,
} from './auth';

/**
 * Console authentication use cases. Their own rule: a pending code challenge is remembered
 * whenever the API asks for a code, and forgotten once the login completes or is abandoned.
 */
export function createAuthUseCases(repository: AuthRepository, challenges: PendingChallengeStore) {
  return {
    getSession: () => repository.getSession(),

    pendingChallenge: () => challenges.load(),

    async signup(input: SignupInput): Promise<CodeChallenge> {
      const challenge = await repository.signup(input);
      challenges.save(challenge);
      return challenge;
    },

    async login(email: string, password: string): Promise<LoginOutcome> {
      const outcome = await repository.login(email, password);
      if (outcome.kind === 'code-required') challenges.save(outcome.challenge);
      else challenges.clear();
      return outcome;
    },

    async verifyCode(challengeId: string, code: string, trustDevice: boolean): Promise<void> {
      await repository.verifyCode(challengeId, code, trustDevice);
      challenges.clear();
    },

    async resendCode(challengeId: string): Promise<CodeChallenge> {
      const challenge = await repository.resendCode(challengeId);
      challenges.save(challenge);
      return challenge;
    },

    async logout(): Promise<void> {
      await repository.logout();
      challenges.clear();
    },

    abandonLogin: () => challenges.clear(),

    switchMembership: (membershipId: string) => repository.switchMembership(membershipId),

    requestPasswordReset: (email: string) => repository.requestPasswordReset(email),

    resetPassword: (token: string, password: string) => repository.resetPassword(token, password),
  };
}

export type AuthUseCases = ReturnType<typeof createAuthUseCases>;
