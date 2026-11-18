// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { describe, expect, it } from 'vitest';
import {
  addMs,
  CONSOLE_AUTH_POLICY as POLICY,
  isChallengeUsable,
  isSessionActive,
  isTrustedDeviceValid,
  pickMembership,
  shouldTouchSession,
} from './policy.js';

const NOW = new Date('2026-11-18T12:00:00Z');
const ago = (ms: number) => addMs(NOW, -ms);

describe('isSessionActive', () => {
  const live = { expiresAt: addMs(NOW, 60_000), lastSeenAt: ago(60_000), revokedAt: null };

  it('accepts a recent, unexpired, unrevoked session', () => {
    expect(isSessionActive(live, NOW)).toBe(true);
  });

  it('rejects revoked, expired and idle sessions', () => {
    expect(isSessionActive({ ...live, revokedAt: ago(1) }, NOW)).toBe(false);
    expect(isSessionActive({ ...live, expiresAt: NOW }, NOW)).toBe(false);
    expect(isSessionActive({ ...live, lastSeenAt: ago(POLICY.sessionIdleMs) }, NOW)).toBe(false);
  });
});

it('touches a session at most once per interval', () => {
  expect(shouldTouchSession(ago(POLICY.sessionTouchIntervalMs - 1), NOW)).toBe(false);
  expect(shouldTouchSession(ago(POLICY.sessionTouchIntervalMs), NOW)).toBe(true);
});

describe('isChallengeUsable', () => {
  const fresh = { expiresAt: addMs(NOW, 60_000), consumedAt: null, attempts: 0 };

  it('accepts an unused, unexpired challenge with attempts left', () => {
    expect(isChallengeUsable({ ...fresh, attempts: POLICY.otpMaxAttempts - 1 }, NOW)).toBe(true);
  });

  it('rejects used, expired and exhausted challenges', () => {
    expect(isChallengeUsable({ ...fresh, consumedAt: NOW }, NOW)).toBe(false);
    expect(isChallengeUsable({ ...fresh, expiresAt: NOW }, NOW)).toBe(false);
    expect(isChallengeUsable({ ...fresh, attempts: POLICY.otpMaxAttempts }, NOW)).toBe(false);
  });
});

describe('isTrustedDeviceValid', () => {
  const device = { createdAt: ago(1_000), expiresAt: addMs(NOW, 1_000), revokedAt: null };

  it('accepts a device trusted after the last password change', () => {
    expect(isTrustedDeviceValid(device, ago(2_000), NOW)).toBe(true);
  });

  it('ignores devices trusted before a password change, expired or revoked', () => {
    expect(isTrustedDeviceValid(device, ago(500), NOW)).toBe(false);
    expect(isTrustedDeviceValid({ ...device, expiresAt: NOW }, ago(2_000), NOW)).toBe(false);
    expect(isTrustedDeviceValid({ ...device, revokedAt: NOW }, ago(2_000), NOW)).toBe(false);
  });
});

describe('pickMembership', () => {
  const older = { id: 'a', createdAt: ago(2_000) };
  const newer = { id: 'b', createdAt: ago(1_000) };

  it('prefers the membership used last', () => {
    expect(pickMembership([older, newer], 'b')).toBe(newer);
  });

  it('falls back to the oldest active membership', () => {
    expect(pickMembership([newer, older], 'gone')).toBe(older);
    expect(pickMembership([newer, older], null)).toBe(older);
    expect(pickMembership([], null)).toBeUndefined();
  });
});
