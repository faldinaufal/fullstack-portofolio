// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

/**
 * Creates a Platform Admin account (FSD 4.3).
 *
 *   pnpm --filter @tempora/api admin:create --email you@example.com --name "Your Name"
 *
 * The password is read from PLATFORM_ADMIN_PASSWORD, or asked for interactively, so it never
 * appears in the shell history or the process list.
 */
import { createInterface } from 'node:readline/promises';
import { parseArgs } from 'node:util';
import { createPrismaClient } from '@tempora/db';
import { createArgon2PasswordHasher } from '../lib/passwords.js';
import { createPlatformAdmin } from '../modules/admin-auth/create-admin.js';

const say = (stream: NodeJS.WriteStream, line: string) => stream.write(`${line}\n`);

const { values } = parseArgs({
  options: { email: { type: 'string' }, name: { type: 'string' } },
});
if (!values.email || !values.name || !process.env.DATABASE_URL) {
  say(
    process.stderr,
    'Usage: admin:create --email <email> --name "<name>" (DATABASE_URL must be set)',
  );
  process.exit(1);
}

let password = process.env.PLATFORM_ADMIN_PASSWORD ?? '';
if (!password) {
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  password = await prompt.question('Password (at least 12 characters): ');
  prompt.close();
}

const prisma = createPrismaClient({ connectionString: process.env.DATABASE_URL });
try {
  const result = await createPlatformAdmin(prisma, createArgon2PasswordHasher(), {
    email: values.email,
    name: values.name,
    password,
  });
  if (result.ok) {
    say(process.stdout, `Platform admin created (${result.id}). Log in at the Platform Admin app.`);
  } else {
    for (const problem of result.problems) say(process.stderr, `- ${problem}`);
    process.exitCode = 1;
  }
} finally {
  await prisma.$disconnect();
}
