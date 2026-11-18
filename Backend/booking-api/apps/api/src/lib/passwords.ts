// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { hash, verify } from '@node-rs/argon2';

/**
 * Argon2id (the library default) with the OWASP-recommended baseline (19 MiB memory,
 * 2 iterations).
 * Argon2id is deliberately slow and memory-hungry, which makes offline guessing of a
 * leaked hash expensive, unlike fast hashes such as SHA-256.
 */
const OPTIONS = { memoryCost: 19_456, timeCost: 2, parallelism: 1 };

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(hash: string, password: string): Promise<boolean>;
  /**
   * Spends the same time as a real check. Used when the email is unknown, so the
   * response time does not reveal whether an account exists (FSD 6.11).
   */
  burnTime(password: string): Promise<void>;
}

export function createArgon2PasswordHasher(): PasswordHasher {
  let dummyHash: Promise<string> | undefined;

  return {
    hash: (password) => hash(password, OPTIONS),
    verify: async (passwordHash, password) => {
      try {
        return await verify(passwordHash, password);
      } catch {
        return false; // malformed hash: treat as a wrong password, never as an error
      }
    },
    burnTime: async (password) => {
      dummyHash ??= hash('tempora-dummy-password', OPTIONS);
      await verify(await dummyHash, password).catch(() => false);
    },
  };
}
