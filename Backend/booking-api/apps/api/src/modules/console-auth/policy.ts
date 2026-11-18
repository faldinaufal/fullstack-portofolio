// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

/**
 * Console authentication rules (FSD 6.11) as plain values and pure functions, so they can be
 * unit-tested without a database and read in one place.
 */
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const CONSOLE_AUTH_POLICY = {
  /** A session ends after 12 h without activity... */
  sessionIdleMs: 12 * HOUR,
  /** ...and 7 days after login at the latest. */
  sessionMaxMs: 7 * DAY,
  /** `last_seen_at` is written at most once a minute, not on every request. */
  sessionTouchIntervalMs: MINUTE,
  otpTtlMs: 10 * MINUTE,
  otpMaxAttempts: 5,
  otpResendCooldownMs: MINUTE,
  trustedDeviceTtlMs: 30 * DAY,
  passwordResetTtlMs: HOUR,
} as const;

export interface SessionTimes {
  expiresAt: Date;
  lastSeenAt: Date;
  revokedAt: Date | null;
}

/** Not revoked, within the absolute lifetime and used recently enough. */
export function isSessionActive(session: SessionTimes, now: Date): boolean {
  return (
    session.revokedAt === null &&
    session.expiresAt > now &&
    now.getTime() - session.lastSeenAt.getTime() < CONSOLE_AUTH_POLICY.sessionIdleMs
  );
}

export function shouldTouchSession(lastSeenAt: Date, now: Date): boolean {
  return now.getTime() - lastSeenAt.getTime() >= CONSOLE_AUTH_POLICY.sessionTouchIntervalMs;
}

export interface ChallengeTimes {
  expiresAt: Date;
  consumedAt: Date | null;
  attempts: number;
}

/** A code can still be tried: not used, not expired and attempts left. */
export function isChallengeUsable(challenge: ChallengeTimes, now: Date): boolean {
  return (
    challenge.consumedAt === null &&
    challenge.expiresAt > now &&
    challenge.attempts < CONSOLE_AUTH_POLICY.otpMaxAttempts
  );
}

export interface TrustedDeviceTimes {
  createdAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
}

/** A trusted device is ignored once the password changed after it was trusted (FSD 6.11). */
export function isTrustedDeviceValid(
  device: TrustedDeviceTimes,
  passwordChangedAt: Date,
  now: Date,
): boolean {
  return (
    device.revokedAt === null && device.expiresAt > now && device.createdAt >= passwordChangedAt
  );
}

/**
 * The membership a new session is bound to: the one used last, if it is still active,
 * otherwise the oldest active one. `memberships` contains active memberships only.
 */
export function pickMembership<T extends { id: string; createdAt: Date }>(
  memberships: T[],
  lastUsedMembershipId: string | null,
): T | undefined {
  const lastUsed = memberships.find((membership) => membership.id === lastUsedMembershipId);
  if (lastUsed) return lastUsed;
  return [...memberships].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
}

export function addMs(date: Date, ms: number): Date {
  return new Date(date.getTime() + ms);
}
