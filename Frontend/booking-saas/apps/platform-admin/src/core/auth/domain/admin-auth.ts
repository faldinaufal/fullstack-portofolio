// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

/** Platform Admin sign-in with an emailed code, and step-up before sensitive actions (FSD 6.11). */

export interface Admin {
  id: string;
  email: string;
  name: string;
  /** Sensitive actions work without a new code until then; null = a code is needed first. */
  stepUpValidUntil: Date | null;
}

export interface CodeChallenge {
  id: string;
  /** Masked address, e.g. `o***@example.com`. */
  sentTo: string;
  expiresAt: Date;
  resendAvailableAt: Date;
}

/** Implemented by the data layer; failures are `RequestError`s. */
export interface AdminAuthRepository {
  /** The signed-in admin, or null without a session. */
  me(): Promise<Admin | null>;
  login(email: string, password: string): Promise<CodeChallenge>;
  verify(challengeId: string, code: string): Promise<void>;
  resend(challengeId: string): Promise<CodeChallenge>;
  logout(): Promise<void>;
  startStepUp(): Promise<CodeChallenge>;
  verifyStepUp(challengeId: string, code: string): Promise<Admin>;
}

/** Whole minutes of step-up left (0 when a code is needed), for the header badge. */
export function stepUpMinutesLeft(admin: Pick<Admin, 'stepUpValidUntil'>, now: Date): number {
  if (!admin.stepUpValidUntil) return 0;
  return Math.max(0, Math.ceil((admin.stepUpValidUntil.getTime() - now.getTime()) / 60_000));
}

/** "Omar Haddad" → "OH". */
export const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0]!.toUpperCase())
    .slice(0, 2)
    .join('');
