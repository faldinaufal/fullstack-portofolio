// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { createPrismaClient } from '@tempora/db';
import closeWithGrace from 'close-with-grace';
import { buildApp } from './app.js';
import { loadEnv } from './config/env.js';
import { createPrismaHealthRepository } from './modules/health/repository.js';

const env = loadEnv();
const prisma = createPrismaClient({ connectionString: env.DATABASE_URL });

const app = await buildApp({
  env,
  healthRepository: createPrismaHealthRepository(prisma),
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
