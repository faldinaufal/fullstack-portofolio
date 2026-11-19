// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { describe, expect, it } from 'vitest';
import { loadEnv } from './env.js';

const base = {
  DATABASE_URL: 'postgresql://tempora_app:app-local@localhost:5432/tempora',
  PORTAL_URL: 'http://localhost:3000',
  CONSOLE_URL: 'http://localhost:3001',
  ADMIN_URL: 'http://localhost:3002',
  TOKEN_HASH_SECRET: 'x'.repeat(32),
};

describe('environment', () => {
  it('runs with demo payments when no Stripe keys are set', () => {
    expect(loadEnv(base).STRIPE_SECRET_KEY).toBeUndefined();
  });

  it('accepts both Stripe keys together', () => {
    const env = loadEnv({
      ...base,
      STRIPE_SECRET_KEY: 'sk_test_4217',
      STRIPE_WEBHOOK_SECRET: 'whsec_4217',
    });
    expect(env.STRIPE_WEBHOOK_SECRET).toBe('whsec_4217');
  });

  it('refuses half a Stripe setup instead of silently using demo payments', () => {
    expect(() => loadEnv({ ...base, STRIPE_SECRET_KEY: 'sk_test_4217' })).toThrow(/or neither/);
    expect(() => loadEnv({ ...base, STRIPE_WEBHOOK_SECRET: 'whsec_4217' })).toThrow(/or neither/);
  });
});
