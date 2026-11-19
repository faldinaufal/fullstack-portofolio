// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

/**
 * What a hashed value is used for. The purpose is mixed into the HMAC, so a hash taken
 * from one table (for example a password-reset token) can never match a row in another
 * (for example a session).
 */
export type TokenPurpose =
  | 'session'
  | 'trusted-device'
  | 'password-reset'
  | 'email-verify'
  | 'invitation'
  | 'csrf'
  | 'rate-limit'
  | `otp:${string}`;

export type TokenHasher = (purpose: TokenPurpose, value: string) => string;

/**
 * Hashes secrets before they are stored (FSD 0.2, 10.4 `TOKEN_HASH_SECRET`).
 *
 * Why HMAC and not a plain SHA-256: the tokens are random and long, so they cannot be
 * guessed, but an HMAC also needs the server secret. A leaked database copy alone is not
 * enough to check guesses of short values such as 6-digit codes.
 * Why not Argon2 like passwords: these values are looked up on every request; HMAC is fast
 * and deterministic, so the hash can be a unique index.
 */
export function createTokenHasher(secret: string): TokenHasher {
  return (purpose, value) =>
    createHmac('sha256', secret).update(`${purpose}\n${value}`).digest('hex');
}

/** 256 random bits, URL-safe. Used for session, device, CSRF and email-link tokens. */
export function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

/** A 6-digit email code, uniformly distributed (leading zeros kept). */
export function generateOtpCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

/** Constant-time string comparison, so response time does not reveal how much matched. */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
