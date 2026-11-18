// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { describe, expect, it } from 'vitest';
import { createTokenHasher, generateOtpCode, generateToken, safeEqual } from './tokens.js';
import { describeDevice, maskEmail } from './user-agent.js';
import { uuidv7 } from './uuid.js';

describe('tokens', () => {
  const hash = createTokenHasher('unit-test-secret-0123456789abcdef0123');

  it('hashes deterministically, separately per purpose and per secret', () => {
    expect(hash('session', 'abc')).toBe(hash('session', 'abc'));
    expect(hash('session', 'abc')).not.toBe(hash('trusted-device', 'abc'));
    expect(hash('session', 'abc')).not.toBe(
      createTokenHasher('another-secret-0123456789abcdef0123')('session', 'abc'),
    );
    expect(hash('session', 'abc')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('generates long URL-safe tokens and 6-digit codes', () => {
    expect(generateToken()).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(generateToken()).not.toBe(generateToken());
    for (let i = 0; i < 200; i += 1) expect(generateOtpCode()).toMatch(/^\d{6}$/);
  });

  it('compares in constant time and handles different lengths', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
  });
});

describe('uuidv7', () => {
  it('produces a version 7 UUID that starts with the timestamp', () => {
    const at = new Date('2026-11-18T12:00:00.000Z');
    const id = uuidv7(at);
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(Number.parseInt(id.replaceAll('-', '').slice(0, 12), 16)).toBe(at.getTime());
  });

  it('sorts by creation time', () => {
    const first = uuidv7(new Date('2026-11-18T12:00:00.000Z'));
    const second = uuidv7(new Date('2026-11-18T12:00:00.001Z'));
    expect(first < second).toBe(true);
  });
});

describe('user agent helpers', () => {
  it('describes common browsers', () => {
    expect(
      describeDevice(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36',
      ),
    ).toBe('Chrome on Windows');
    expect(
      describeDevice(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
      ),
    ).toBe('Safari on iOS');
    expect(describeDevice(undefined)).toBe('Unknown device');
  });

  it('masks an email address', () => {
    expect(maskEmail('maya@veloria.test')).toBe('m***@veloria.test');
  });
});
