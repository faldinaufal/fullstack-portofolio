// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

/** Console authentication as the app understands it, independent of the HTTP contract. */

export type MemberRole = 'owner' | 'manager' | 'staff';

export interface Membership {
  id: string;
  role: MemberRole;
  /** Null for owners (whole business). */
  branchId: string | null;
  tenant: { id: string; slug: string; name: string };
}

export interface ConsoleSession {
  account: { id: string; email: string; name: string };
  activeMembership: Membership;
  memberships: Membership[];
}

/** A 6-digit code was emailed and must be entered to finish logging in. */
export interface CodeChallenge {
  id: string;
  /** Masked address, e.g. `m***@example.com`. */
  sentTo: string;
  expiresAt: Date;
  resendAvailableAt: Date;
}

export type LoginOutcome =
  | { kind: 'code-required'; challenge: CodeChallenge }
  /** A trusted device skipped the code. */
  | { kind: 'signed-in' };

export interface SignupInput {
  name: string;
  email: string;
  password: string;
  businessName: string;
  slug: string;
}

export type AuthErrorKind =
  | 'invalid-credentials'
  | 'code-invalid'
  | 'code-expired'
  | 'link-invalid'
  | 'email-taken'
  | 'slug-taken'
  | 'no-business'
  | 'rate-limited'
  | 'invalid-input'
  | 'unavailable'
  | 'unexpected';

export interface FieldProblem {
  field: string;
  message: string;
}

/** Every failure of an auth action, already classified for the screens. */
export class AuthError extends Error {
  readonly kind: AuthErrorKind;
  readonly fields: FieldProblem[];
  /** Shown for unexpected errors so support can find the request (FSD 8.5). */
  readonly requestId: string | undefined;

  constructor(
    kind: AuthErrorKind,
    message: string,
    { fields = [], requestId }: { fields?: FieldProblem[]; requestId?: string | undefined } = {},
  ) {
    super(message);
    this.name = 'AuthError';
    this.kind = kind;
    this.fields = fields;
    this.requestId = requestId;
  }
}

/** Implemented by the data layer (HTTP); repositories throw `AuthError` only. */
export interface AuthRepository {
  /** The current session, or null when nobody is logged in. */
  getSession(): Promise<ConsoleSession | null>;
  signup(input: SignupInput): Promise<CodeChallenge>;
  login(email: string, password: string): Promise<LoginOutcome>;
  verifyCode(challengeId: string, code: string, trustDevice: boolean): Promise<void>;
  resendCode(challengeId: string): Promise<CodeChallenge>;
  logout(): Promise<void>;
  requestPasswordReset(email: string): Promise<void>;
  resetPassword(token: string, password: string): Promise<void>;
}

/** Keeps the pending code challenge between the login and verify screens (and a reload). */
export interface PendingChallengeStore {
  save(challenge: CodeChallenge): void;
  load(): CodeChallenge | null;
  clear(): void;
}
