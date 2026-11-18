// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { PrismaClient } from '@tempora/db';
import { AppError } from './app-error.js';
import type { TokenHasher } from './tokens.js';

/** One limit: at most `max` counted events per `windowMs` for the same key (FSD 6.11). */
export interface RateLimitRule {
  bucket: string;
  max: number;
  windowMs: number;
}

export const RATE_LIMITS = {
  /** Failed logins per email + IP. */
  consoleLoginFailure: { bucket: 'console.login.failure', max: 5, windowMs: 15 * 60_000 },
  /** Code resends per account. */
  consoleOtpResend: { bucket: 'console.otp.resend', max: 5, windowMs: 15 * 60_000 },
  /** Password-reset requests per email + IP. */
  consolePasswordReset: { bucket: 'console.password.reset', max: 5, windowMs: 15 * 60_000 },
  /** Business sign-ups per IP (FSD 10.3). */
  consoleSignup: { bucket: 'console.signup', max: 5, windowMs: 60 * 60_000 },
} satisfies Record<string, RateLimitRule>;

export interface RateLimiter {
  /** Throws `429 RATE_LIMITED` when the key already used up the rule's allowance. */
  assertAllowed(rule: RateLimitRule, key: string): Promise<void>;
  /** Counts one event for the key. */
  record(rule: RateLimitRule, key: string): Promise<void>;
}

/**
 * Counts events in PostgreSQL instead of process memory, so the limits stay correct when
 * several API containers run behind a load balancer (FSD 8.2). Keys are HMAC-hashed:
 * the table never stores emails or IP addresses in clear.
 */
export function createPostgresRateLimiter(
  prisma: PrismaClient,
  hashToken: TokenHasher,
  now: () => Date = () => new Date(),
): RateLimiter {
  const keyHash = (rule: RateLimitRule, key: string) =>
    hashToken('rate-limit', `${rule.bucket}\n${key}`);

  return {
    async assertAllowed(rule, key) {
      const since = new Date(now().getTime() - rule.windowMs);
      const count = await prisma.rateLimitHit.count({
        where: { bucket: rule.bucket, keyHash: keyHash(rule, key), createdAt: { gt: since } },
      });
      if (count >= rule.max) {
        throw new AppError({
          status: 429,
          code: 'RATE_LIMITED',
          title: 'Too many attempts',
          detail: `Too many attempts. Try again in ${Math.ceil(rule.windowMs / 60_000)} minutes.`,
        });
      }
    },
    async record(rule, key) {
      await prisma.rateLimitHit.create({
        data: { bucket: rule.bucket, keyHash: keyHash(rule, key), createdAt: now() },
      });
    },
  };
}
