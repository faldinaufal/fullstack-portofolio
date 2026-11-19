// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

/**
 * Platform Admin authentication rules (FSD 6.11): shorter sessions than the Console, a code
 * at every login, and a fresh code before sensitive actions (step-up). Pure functions.
 */
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

export const ADMIN_AUTH_POLICY = {
  /** 1 h without activity... */
  sessionIdleMs: HOUR,
  /** ...and 8 h after login at the latest. */
  sessionMaxMs: 8 * HOUR,
  sessionTouchIntervalMs: MINUTE,
  /** Sensitive actions need a step-up verified in the last 10 minutes. */
  stepUpTtlMs: 10 * MINUTE,
  otpTtlMs: 10 * MINUTE,
  otpMaxAttempts: 5,
  otpResendCooldownMs: MINUTE,
} as const;

export function isAdminSessionActive(
  session: { expiresAt: Date; lastSeenAt: Date; revokedAt: Date | null },
  now: Date,
): boolean {
  return (
    session.revokedAt === null &&
    session.expiresAt > now &&
    now.getTime() - session.lastSeenAt.getTime() < ADMIN_AUTH_POLICY.sessionIdleMs
  );
}

/** Until when sensitive actions work without asking for a new code; null = ask now. */
export function stepUpValidUntil(stepUpAt: Date | null, now: Date): Date | null {
  if (!stepUpAt) return null;
  const until = new Date(stepUpAt.getTime() + ADMIN_AUTH_POLICY.stepUpTtlMs);
  return until > now ? until : null;
}

export function isCodeUsable(
  challenge: { expiresAt: Date; consumedAt: Date | null; attempts: number },
  now: Date,
): boolean {
  return (
    challenge.consumedAt === null &&
    challenge.expiresAt > now &&
    challenge.attempts < ADMIN_AUTH_POLICY.otpMaxAttempts
  );
}
