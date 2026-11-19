// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

/** A customer's Portal account (FSD 2.1 Sign up / log in, Profile and security). */
export interface Customer {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  emailVerified: boolean;
}

export interface SignupInput {
  name: string;
  email: string;
  password: string;
  phone?: string;
}

export interface ActiveSession {
  id: string;
  device: string;
  lastSeenAt: Date;
  current: boolean;
}

/** Implemented by the data layer; failures are `RequestError`s. */
export interface AccountRepository {
  /** The signed-in customer, or null for a visitor. */
  getCustomer(): Promise<Customer | null>;
  signup(input: SignupInput): Promise<Customer>;
  login(email: string, password: string): Promise<Customer>;
  logout(): Promise<void>;
  logoutEverywhere(): Promise<void>;
  verifyEmail(token: string): Promise<Customer>;
  resendVerification(): Promise<void>;
  requestPasswordReset(email: string): Promise<void>;
  resetPassword(token: string, password: string): Promise<void>;
  updateProfile(input: { name?: string; phone?: string | null }): Promise<Customer>;
  changePassword(currentPassword: string, newPassword: string): Promise<void>;
  listSessions(): Promise<ActiveSession[]>;
  revokeSession(id: string): Promise<void>;
}

export const PASSWORD_MIN_LENGTH = 12;

/** Instant checks before calling the API, which validates everything again. */
export function signupProblems(input: SignupInput): Record<string, string> {
  const problems: Record<string, string> = {};
  if (input.name.trim().length < 2) problems.name = 'Enter your name.';
  if (!/^\S+@\S+\.\S+$/.test(input.email.trim())) problems.email = 'Enter a valid email address.';
  const local = input.email.trim().toLowerCase().split('@')[0] ?? '';
  if (input.password.length < PASSWORD_MIN_LENGTH) {
    problems.password = `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  } else if (local.length >= 3 && input.password.toLowerCase().includes(local)) {
    problems.password = 'Must not contain your email address.';
  }
  if (input.phone && !/^\+[1-9]\d{6,14}$/.test(input.phone)) {
    problems.phone = 'Use the international format, e.g. +15550147123.';
  }
  return problems;
}
