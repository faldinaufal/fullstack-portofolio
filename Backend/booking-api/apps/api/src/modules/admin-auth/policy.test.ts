// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { describe, expect, it } from 'vitest';
import { isAdminSessionActive, isCodeUsable, stepUpValidUntil } from './policy.js';

const MINUTE = 60_000;
const now = new Date('2026-11-23T15:00:00Z');
const ago = (minutes: number) => new Date(now.getTime() - minutes * MINUTE);

describe('Platform Admin sessions (FSD 6.11)', () => {
  it('end after 1 h idle or at their maximum, or when revoked', () => {
    const session = { expiresAt: new Date(now.getTime() + MINUTE), revokedAt: null };
    expect(isAdminSessionActive({ ...session, lastSeenAt: ago(59) }, now)).toBe(true);
    expect(isAdminSessionActive({ ...session, lastSeenAt: ago(60) }, now)).toBe(false);
    expect(isAdminSessionActive({ ...session, expiresAt: now, lastSeenAt: ago(1) }, now)).toBe(
      false,
    );
    expect(isAdminSessionActive({ ...session, lastSeenAt: ago(1), revokedAt: ago(1) }, now)).toBe(
      false,
    );
  });

  it('a step-up is fresh for 10 minutes', () => {
    expect(stepUpValidUntil(ago(9), now)).toEqual(new Date(now.getTime() + MINUTE));
    expect(stepUpValidUntil(ago(10), now)).toBeNull();
    expect(stepUpValidUntil(null, now)).toBeNull();
  });

  it('a code works until used, expired or tried five times', () => {
    const code = { expiresAt: new Date(now.getTime() + MINUTE), consumedAt: null, attempts: 4 };
    expect(isCodeUsable(code, now)).toBe(true);
    expect(isCodeUsable({ ...code, attempts: 5 }, now)).toBe(false);
    expect(isCodeUsable({ ...code, consumedAt: ago(1) }, now)).toBe(false);
    expect(isCodeUsable({ ...code, expiresAt: now }, now)).toBe(false);
  });
});
