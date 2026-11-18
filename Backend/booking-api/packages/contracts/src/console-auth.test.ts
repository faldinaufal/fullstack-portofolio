// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { describe, expect, it } from 'vitest';
import {
  ConsoleSignupRequestSchema,
  EmailSchema,
  passwordContainsEmail,
  SlugSchema,
  VerifyOtpRequestSchema,
} from './console-auth.js';

describe('field rules', () => {
  it('normalises emails to trimmed lowercase', () => {
    expect(EmailSchema.parse('  Maya@Veloria.TEST ')).toBe('maya@veloria.test');
    expect(EmailSchema.safeParse('not-an-email').success).toBe(false);
  });

  it('accepts only lowercase slugs with single hyphens', () => {
    expect(SlugSchema.safeParse('lumen-wellness').success).toBe(true);
    for (const bad of ['Lumen', 'lu', 'lumen--studio', '-lumen', 'lumen_studio']) {
      expect(SlugSchema.safeParse(bad).success).toBe(false);
    }
  });

  it('detects a password that contains the email or its local part', () => {
    expect(passwordContainsEmail('my maya@veloria.test pass', 'maya@veloria.test')).toBe(true);
    expect(passwordContainsEmail('MAYA-forever-2026', 'maya@veloria.test')).toBe(true);
    expect(passwordContainsEmail('correct horse battery', 'maya@veloria.test')).toBe(false);
    // Very short local parts would match too much, so they are not checked.
    expect(passwordContainsEmail('a long passphrase', 'al@veloria.test')).toBe(false);
  });
});

describe('requests', () => {
  it('requires a 12-character password at sign-up', () => {
    const base = {
      name: 'Maya Reyes',
      email: 'maya@veloria.test',
      businessName: 'Lumen Wellness Studio',
      slug: 'lumen',
    };
    expect(ConsoleSignupRequestSchema.safeParse({ ...base, password: 'short pass' }).success).toBe(
      false,
    );
    expect(
      ConsoleSignupRequestSchema.safeParse({ ...base, password: 'twelve chars' }).success,
    ).toBe(true);
  });

  it('accepts only 6-digit codes and defaults trustDevice to false', () => {
    const challengeId = '0196a000-0000-7000-8000-000000000001';
    expect(VerifyOtpRequestSchema.parse({ challengeId, code: '012345' }).trustDevice).toBe(false);
    expect(VerifyOtpRequestSchema.safeParse({ challengeId, code: '12345' }).success).toBe(false);
    expect(VerifyOtpRequestSchema.safeParse({ challengeId, code: '12345a' }).success).toBe(false);
  });
});
