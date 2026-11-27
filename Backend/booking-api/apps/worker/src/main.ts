// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { setTimeout as sleep } from 'node:timers/promises';
import closeWithGrace from 'close-with-grace';
import pg from 'pg';
import { PgBoss } from 'pg-boss';
import { pino } from 'pino';
import { loadEnv } from './config/env.js';
import { createDemoInboxMailer } from './email/demo-inbox.js';
import { createSmtpMailer } from './email/mailer.js';
import { createOutboxProcessor } from './email/outbox.js';
import { createAutoCompleteHandler } from './jobs/auto-complete.js';
import { createSupportExpiryHandler } from './jobs/support-expiry.js';
import { createExpireHoldsHandler } from './jobs/expire-holds.js';
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

// Unpaid holds are released every minute (FSD 6.4). The availability rules already ignore
// holds whose time has passed, so this only makes the status and invoice catch up.
const jobsPool = new pg.Pool({
  connectionString: env.JOBS_DATABASE_URL,
  max: 2,
  application_name: 'tempora-worker-jobs',
});
await boss.createQueue(QUEUES.expireHolds, { retryLimit: 0 });
await boss.schedule(QUEUES.expireHolds, '* * * * *');
await boss.work(QUEUES.expireHolds, createExpireHoldsHandler(jobsPool, logger));

// FSD 6.7: hourly, at minute 7 (away from the top of the hour when other jobs run).
await boss.createQueue(QUEUES.autoComplete, { retryLimit: 0 });
await boss.schedule(QUEUES.autoComplete, '7 * * * *');
await boss.work(QUEUES.autoComplete, createAutoCompleteHandler(jobsPool, logger));

// FSD 1.4: support grant expiries in the audit log, every 5 minutes.
await boss.createQueue(QUEUES.supportExpiry, { retryLimit: 0 });
await boss.schedule(QUEUES.supportExpiry, '*/5 * * * *');
await boss.work(QUEUES.supportExpiry, createSupportExpiryHandler(jobsPool, logger));

// Email outbox (FSD 0.2): the API queues emails in `email_messages` inside its own
// transactions; this loop sends them. A full batch means more may be waiting, so the next
// batch starts right away; otherwise the loop waits for the poll interval.
const OUTBOX_BATCH_SIZE = 20;
const outboxPool = new pg.Pool({
  connectionString: env.JOBS_DATABASE_URL,
  max: 2,
  application_name: 'tempora-worker-outbox',
});
const smtp = createSmtpMailer({ url: env.SMTP_URL, from: env.EMAIL_FROM });
const outbox = createOutboxProcessor({
  db: outboxPool,
  // FSD 10.3: on a demo deployment, emails to demo addresses land in the public demo inbox.
  mailer:
    env.DEMO_MODE && env.DEMO_EMAIL_DOMAIN
      ? createDemoInboxMailer({ db: outboxPool, domain: env.DEMO_EMAIL_DOMAIN, fallback: smtp })
      : smtp,
  logger,
  batchSize: OUTBOX_BATCH_SIZE,
});
let stopping = false;
const outboxLoop = (async () => {
  while (!stopping) {
    try {
      const { sent, failed } = await outbox.processBatch();
      if (sent + failed === OUTBOX_BATCH_SIZE) continue;
    } catch (err) {
      logger.error({ err }, 'Email outbox batch failed');
    }
    await sleep(env.EMAIL_POLL_INTERVAL_MS);
  }
})();

logger.info({ queues: Object.values(QUEUES) }, 'Worker started');

// Graceful shutdown (FSD 8.5): stop taking new jobs, let running jobs finish, then exit.
closeWithGrace({ delay: 30_000 }, async ({ err, signal }) => {
  if (err) logger.error({ err }, 'Shutting down after an error');
  else logger.info({ signal }, 'Shutting down');
  stopping = true;
  await boss.stop({ graceful: true, timeout: 25_000 });
  await outboxLoop;
  await outboxPool.end();
  await jobsPool.end();
});
