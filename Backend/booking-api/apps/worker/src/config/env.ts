// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  /** Connection for the `tempora_jobs` role, which owns only the `pgboss` schema. */
  JOBS_DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  /** SMTP endpoint: Mailpit locally (smtp://localhost:1025), the email provider in production. */
  SMTP_URL: z.url({ protocol: /^smtps?$/ }),
  /** Sender, e.g. `Tempora <no-reply@example.com>`. */
  EMAIL_FROM: z.string().min(3),
  /** How often the email outbox is checked when it is empty. */
  EMAIL_POLL_INTERVAL_MS: z.coerce.number().int().min(250).default(2_000),
});

export type Env = z.infer<typeof EnvSchema>;

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
