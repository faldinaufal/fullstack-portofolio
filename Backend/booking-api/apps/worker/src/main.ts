// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import closeWithGrace from 'close-with-grace';
import { PgBoss } from 'pg-boss';
import { pino } from 'pino';
import { loadEnv } from './config/env.js';
import { createHeartbeatHandler } from './jobs/heartbeat.js';
import { QUEUES } from './queues.js';

const env = loadEnv();
const logger = pino({ name: 'tempora-worker', level: env.LOG_LEVEL });

// The worker connects as `tempora_jobs`, which owns the `pgboss` schema and nothing else.
// pg-boss creates and upgrades its own tables there on start-up, and creates one table
// partition per queue, so this role needs DDL rights in that schema (and only there).
const boss = new PgBoss({
  connectionString: env.JOBS_DATABASE_URL,
  schema: 'pgboss',
  application_name: 'tempora-worker',
});

boss.on('error', (err) => logger.error({ err }, 'pg-boss error'));

await boss.start();

await boss.createQueue(QUEUES.heartbeat, { retryLimit: 0 });
await boss.schedule(QUEUES.heartbeat, '*/5 * * * *', { scheduledBy: 'cron' });
await boss.work(QUEUES.heartbeat, createHeartbeatHandler(logger));

logger.info({ queues: Object.values(QUEUES) }, 'Worker started');

// Graceful shutdown (FSD 8.5): stop taking new jobs, let running jobs finish, then exit.
closeWithGrace({ delay: 30_000 }, async ({ err, signal }) => {
  if (err) logger.error({ err }, 'Shutting down after an error');
  else logger.info({ signal }, 'Shutting down');
  await boss.stop({ graceful: true, timeout: 25_000 });
});
