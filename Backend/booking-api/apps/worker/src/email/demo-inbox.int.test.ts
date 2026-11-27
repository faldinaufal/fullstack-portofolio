// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { DEMO_INBOX_LIMIT } from '@tempora/db/emails';
import pg from 'pg';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createDemoInboxMailer } from './demo-inbox.js';
import { createOutboxProcessor, type Mailer } from './outbox.js';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} must be set for integration tests.`);
  return value;
}

const DOMAIN = 'demo.tempora.test';
// The worker's own role, with exactly the rights the migrations grant it.
const jobs = new pg.Pool({ connectionString: requireEnv('TEST_JOBS_DATABASE_URL'), max: 2 });
const owner = new pg.Pool({ connectionString: requireEnv('TEST_DATABASE_OWNER_URL'), max: 2 });
const logger = { info: () => {}, warn: () => {}, error: () => {} };

afterAll(async () => {
  await jobs.end();
  await owner.end();
});

beforeEach(async () => {
  await owner.query('TRUNCATE email_messages, demo_emails');
});

async function queue(to: string) {
  const { rows } = await owner.query<{ id: string }>(
    `INSERT INTO email_messages (id, to_email, template, payload)
     VALUES (gen_random_uuid(), $1, 'console.login_code', $2) RETURNING id`,
    [to, JSON.stringify({ name: 'Ines', code: '421700', expiresInMinutes: 10 })],
  );
  return rows[0]!.id;
}

function setup() {
  const smtp: string[] = [];
  const fallback: Mailer = {
    send: async (message) => {
      smtp.push(message.to);
      return { messageId: '<test@mailpit>' };
    },
  };
  const outbox = createOutboxProcessor({
    db: jobs,
    mailer: createDemoInboxMailer({ db: jobs, domain: DOMAIN, fallback }),
    logger,
  });
  return { outbox, smtp };
}

describe('demo inbox delivery (FSD 10.3, as tempora_jobs)', () => {
  it('stores demo emails rendered instead of sending them; other addresses go to SMTP', async () => {
    const { outbox, smtp } = setup();
    const demo = await queue(`Owner@${DOMAIN}`);
    const real = await queue('someone@example.com');

    expect(await outbox.processBatch()).toMatchObject({ sent: 2, failed: 0 });

    expect(smtp).toEqual(['someone@example.com']);
    const { rows: inbox } = await owner.query(
      'SELECT to_email, template, subject, text_body FROM demo_emails',
    );
    expect(inbox).toEqual([
      {
        to_email: `owner@${DOMAIN}`,
        template: 'console.login_code',
        subject: '421700 is your Tempora Console code',
        text_body: expect.stringContaining('Your login code is 421700.'),
      },
    ]);

    // The outbox row is finished like any sent email: status, provider id, payload erased.
    const { rows } = await owner.query(
      'SELECT id, status, payload, provider_message_id FROM email_messages ORDER BY id',
    );
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
    expect(byId[demo]).toMatchObject({ status: 'sent', payload: null });
    expect(byId[demo].provider_message_id).toMatch(/^demo-inbox:/);
    expect(byId[real]).toMatchObject({ status: 'sent', provider_message_id: '<test@mailpit>' });
  });

  it('keeps one day and at most the newest emails', async () => {
    await owner.query(
      `INSERT INTO demo_emails (id, to_email, template, subject, text_body, created_at)
       VALUES (gen_random_uuid(), $1, 't', 'Two days old', 'b', now() - interval '2 days')`,
      [`owner@${DOMAIN}`],
    );
    await owner.query(
      `INSERT INTO demo_emails (id, to_email, template, subject, text_body, created_at)
       SELECT gen_random_uuid(), $1, 't', 'Recent ' || n, 'b', now() - n * interval '1 second'
       FROM generate_series(1, $2::int) AS n`,
      [`owner@${DOMAIN}`, DEMO_INBOX_LIMIT],
    );

    const { outbox } = setup();
    await queue(`owner@${DOMAIN}`);
    await outbox.processBatch();

    const { rows } = await owner.query<{ subject: string }>(
      'SELECT subject FROM demo_emails ORDER BY created_at DESC',
    );
    expect(rows).toHaveLength(DEMO_INBOX_LIMIT);
    expect(rows[0]!.subject).toBe('421700 is your Tempora Console code');
    expect(rows.map((r) => r.subject)).not.toContain('Two days old');
    expect(rows.map((r) => r.subject)).not.toContain(`Recent ${DEMO_INBOX_LIMIT}`);
  });

  it('may not change a stored email', async () => {
    await expect(jobs.query(`UPDATE demo_emails SET subject = 'x'`)).rejects.toThrow(
      /permission denied/,
    );
  });
});
