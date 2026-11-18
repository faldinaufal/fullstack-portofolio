// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  APP_VERSION: z.string().default('dev'),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  PORTAL_URL: z.url(),
  CONSOLE_URL: z.url(),
  ADMIN_URL: z.url(),
  /** Secret for HMAC-hashing session, code and link tokens (FSD 10.4). At least 32 characters. */
  TOKEN_HASH_SECRET: z.string().min(32),
  /** Parent domain for cookies in production (e.g. `.example.com`); unset for localhost. */
  COOKIE_DOMAIN: z.string().min(1).optional(),
  /** Trust X-Forwarded-For from the hosting proxy, so rate limits see the real client IP. */
  TRUST_PROXY: z.stringbool().default(false),
});

export type Env = z.infer<typeof EnvSchema>;

/**
 * Reads and validates environment variables once at startup.
 * A missing or malformed variable stops the process immediately with a clear message,
 * instead of failing later in the middle of a request.
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = EnvSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  return result.data;
}
