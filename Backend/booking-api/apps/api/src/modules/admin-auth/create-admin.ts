// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import {
  EmailSchema,
  passwordContainsEmail,
  PASSWORD_MIN_LENGTH,
  PersonNameSchema,
} from '@tempora/contracts';
import type { PrismaClient } from '@tempora/db';
import type { PasswordHasher } from '../../lib/passwords.js';

/**
 * Creates a platform admin (FSD 4.3: only by a server-side command, never through the API).
 * The same password rules as team accounts. Returns problems instead of throwing, so the
 * command can print them.
 */
export async function createPlatformAdmin(
  prisma: PrismaClient,
  passwords: PasswordHasher,
  input: { email: string; name: string; password: string },
): Promise<{ ok: true; id: string } | { ok: false; problems: string[] }> {
  const email = EmailSchema.safeParse(input.email);
  const name = PersonNameSchema.safeParse(input.name);
  const problems: string[] = [];
  if (!email.success) problems.push('Enter a valid email address.');
  if (!name.success) problems.push('Enter a name of 2 to 100 characters.');
  if (input.password.length < PASSWORD_MIN_LENGTH) {
    problems.push(`Use a password of at least ${PASSWORD_MIN_LENGTH} characters.`);
  } else if (email.success && passwordContainsEmail(input.password, email.data)) {
    problems.push('The password must not contain the email address.');
  }
  if (!email.success || !name.success || problems.length > 0) return { ok: false, problems };

  if (await prisma.platformAdmin.findUnique({ where: { email: email.data } })) {
    return { ok: false, problems: ['A platform admin with this email already exists.'] };
  }
  const admin = await prisma.platformAdmin.create({
    data: {
      email: email.data,
      name: name.data,
      passwordHash: await passwords.hash(input.password),
    },
  });
  return { ok: true, id: admin.id };
}
