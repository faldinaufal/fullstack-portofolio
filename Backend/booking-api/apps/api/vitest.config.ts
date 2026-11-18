// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { defineConfig } from 'vitest/config';

// Unit tests: no database, run everywhere (`pnpm test`).
// Integration tests (*.int.test.ts) need PostgreSQL and run with `pnpm test:integration`.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['src/**/*.int.test.ts'],
  },
});
