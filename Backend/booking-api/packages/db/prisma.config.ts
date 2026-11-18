// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { existsSync } from 'node:fs';
import { defineConfig } from 'prisma/config';

// Local development reads a git-ignored .env file; Docker, CI and hosting pass real env vars.
if (existsSync('.env')) process.loadEnvFile('.env');

// Migrations run with the migration (owner) role, never with the application role.
// The application role has no DDL rights and is restricted by row-level security (FSD 4.4).
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_MIGRATION_URL ?? '',
  },
});
