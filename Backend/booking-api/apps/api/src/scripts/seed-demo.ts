// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

/**
 * Seeds the demo businesses and accounts (FSD 10.3). Runs with the owner role, because it
 * writes several businesses at once and so has to bypass row-level security.
 *
 *   pnpm --filter @tempora/api demo:seed           # only when the demo is not there yet
 *   pnpm --filter @tempora/api demo:seed --reset   # back to the seed state
 *
 * DATABASE_MIGRATION_URL (owner) is required. DEMO_PASSWORD sets the demo accounts' password
 * (default below, as listed in the README); APP_TIME_ZONE and PORTAL_URL as for the API.
 * DEMO_EMAIL_DOMAIN moves every demo address to that domain (FSD 10.3; `demo.<domain>` live).
 */
import { parseArgs } from 'node:util';
import { createPrismaClient } from '@tempora/db';
import { createArgon2PasswordHasher } from '../lib/passwords.js';
import { seedDemo } from '../modules/demo/seed.js';

const DEFAULT_PASSWORD = 'tempora-demo-2026';

const say = (stream: NodeJS.WriteStream, line: string) => stream.write(`${line}\n`);

const { values } = parseArgs({ options: { reset: { type: 'boolean', default: false } } });
const url = process.env.DATABASE_MIGRATION_URL;
if (!url) {
  say(process.stderr, 'DATABASE_MIGRATION_URL (the owner role) must be set.');
  process.exit(1);
}

const owner = createPrismaClient({ connectionString: url, maxConnections: 2 });
try {
  const started = Date.now();
  const result = await seedDemo(
    owner,
    {
      now: new Date(),
      timeZone: process.env.APP_TIME_ZONE ?? 'America/New_York',
      passwordHash: await createArgon2PasswordHasher().hash(
        process.env.DEMO_PASSWORD ?? DEFAULT_PASSWORD,
      ),
      portalUrl: process.env.PORTAL_URL ?? 'http://localhost:3000',
      ...(process.env.DEMO_EMAIL_DOMAIN && {
        emailDomain: process.env.DEMO_EMAIL_DOMAIN.trim().toLowerCase(),
      }),
    },
    { reset: values.reset },
  );
  say(
    process.stdout,
    result.seeded
      ? `Demo seeded: ${result.bookings} bookings in ${Math.round((Date.now() - started) / 100) / 10} s.`
      : 'Demo already there; nothing changed (use --reset to start again).',
  );
} catch (error) {
  say(process.stderr, `Seeding failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  await owner.$disconnect();
}
