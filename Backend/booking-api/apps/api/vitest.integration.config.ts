// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { defineConfig } from 'vitest/config';

// Integration tests run through HTTP against a migrated PostgreSQL (FSD 9.1).
// They share one database and reset it between tests, so files run one after another.
//   TEST_DATABASE_URL        application role (tempora_app): what the API uses, RLS enforced
//   TEST_DATABASE_OWNER_URL  owner role: resets tables and inspects rows the API cannot see
export default defineConfig({
  test: {
    include: ['src/**/*.int.test.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
