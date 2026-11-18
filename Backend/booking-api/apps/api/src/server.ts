// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { createPrismaClient } from '@tempora/db';
import closeWithGrace from 'close-with-grace';
import { buildApp } from './app.js';
import { loadEnv } from './config/env.js';
import { createArgon2PasswordHasher } from './lib/passwords.js';
import { createPostgresRateLimiter } from './lib/rate-limit.js';
import { createTokenHasher } from './lib/tokens.js';
import { createConsoleAuthService } from './modules/console-auth/service.js';
import { createPrismaHealthRepository } from './modules/health/repository.js';

const env = loadEnv();
const prisma = createPrismaClient({ connectionString: env.DATABASE_URL });

const hashToken = createTokenHasher(env.TOKEN_HASH_SECRET);

const app = await buildApp({
  env,
  healthRepository: createPrismaHealthRepository(prisma),
  consoleAuth: {
    service: createConsoleAuthService({
      prisma,
      passwords: createArgon2PasswordHasher(),
      hashToken,
      rateLimiter: createPostgresRateLimiter(prisma, hashToken),
      consoleUrl: env.CONSOLE_URL,
    }),
    cookies: { secure: env.NODE_ENV === 'production', domain: env.COOKIE_DOMAIN },
  },
});

// Graceful shutdown (FSD 8.5): on SIGTERM during a deploy, stop accepting new requests,
// let in-flight requests finish, then close the database pool.
closeWithGrace({ delay: 10_000 }, async ({ err, signal }) => {
  if (err) app.log.error({ err }, 'Shutting down after an error');
  else app.log.info({ signal }, 'Shutting down');
  await app.close();
  await prisma.$disconnect();
});

await app.listen({ host: env.HOST, port: env.PORT });
