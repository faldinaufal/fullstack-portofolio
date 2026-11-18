// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { defineConfig } from 'vitest/config';

// Integration tests against a migrated PostgreSQL:
//   TEST_JOBS_DATABASE_URL   jobs role (tempora_jobs): what the worker uses
//   TEST_DATABASE_OWNER_URL  owner role: inserts fixtures and reads results
export default defineConfig({
  test: {
    include: ['src/**/*.int.test.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
  },
});
