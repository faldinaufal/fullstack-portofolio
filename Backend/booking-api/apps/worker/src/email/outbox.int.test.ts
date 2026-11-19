// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { EMAIL_MAX_ATTEMPTS } from '@tempora/db/emails';
import pg from 'pg';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createOutboxProcessor, type Mailer } from './outbox.js';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} must be set for integration tests.`);
  return value;
}

// The worker's own role, with exactly the rights the migration grants it.
const jobs = new pg.Pool({ connectionString: requireEnv('TEST_JOBS_DATABASE_URL'), max: 2 });
// Owner: inserts fixtures and reads results.
const owner = new pg.Pool({ connectionString: requireEnv('TEST_DATABASE_OWNER_URL'), max: 2 });
const logger = { info: () => {}, warn: () => {}, error: () => {} };

afterAll(async () => {
  await jobs.end();
  await owner.end();
});

beforeEach(async () => {
  await owner.query('TRUNCATE email_messages');
});

async function queue(template = 'console.login_code', payload: object | null = sample) {
  const { rows } = await owner.query<{ id: string }>(
    `INSERT INTO email_messages (id, to_email, template, payload)
     VALUES (gen_random_uuid(), 'ines.halvorsen@veloria.test', $1, $2) RETURNING id`,
    [template, payload === null ? null : JSON.stringify(payload)],
  );
  return rows[0]!.id;
}
const sample = { name: 'Ines', code: '421700', expiresInMinutes: 10 };

async function row(id: string) {
  const { rows } = await owner.query('SELECT * FROM email_messages WHERE id = $1', [id]);
  return rows[0] as {
    status: string;
    payload: unknown;
    attempts: number;
    last_error: string | null;
  };
}

describe('email outbox (as tempora_jobs)', () => {
  it('sends a queued email, records it and erases the template data', async () => {
    const sent: { to: string; subject: string }[] = [];
    const mailer: Mailer = {
      send: async (message) => {
        sent.push(message);
        return { messageId: '<test@mailpit>' };
      },
    };
    const id = await queue();

    const result = await createOutboxProcessor({ db: jobs, mailer, logger }).processBatch();

    expect(result).toEqual({ sent: 1, failed: 0, skipped: 0 });
    expect(sent[0]).toMatchObject({ to: 'ines.halvorsen@veloria.test' });
    expect(sent[0]!.subject).toContain('421700');
    expect(await row(id)).toMatchObject({ status: 'sent', payload: null, attempts: 1 });
  });

  it('retries later after a failure and gives up after the last attempt', async () => {
    const mailer: Mailer = {
      send: async () => {
        throw new Error('SMTP down');
      },
    };
    const outbox = createOutboxProcessor({ db: jobs, mailer, logger });
    const id = await queue();

    await outbox.processBatch();
    expect(await row(id)).toMatchObject({ status: 'queued', attempts: 1, last_error: 'SMTP down' });
    expect((await outbox.processBatch()).failed).toBe(0); // not due yet: back-off

    await owner.query(
      'UPDATE email_messages SET attempts = $2, next_attempt_at = now() WHERE id = $1',
      [id, EMAIL_MAX_ATTEMPTS - 1],
    );
    await outbox.processBatch();
    expect(await row(id)).toMatchObject({ status: 'failed', payload: null });
  });

  it('never sends the same message twice when two workers poll at once', async () => {
    const sends: string[] = [];
    const mailer: Mailer = {
      send: async ({ to }) => {
        sends.push(to);
        return { messageId: '<id>' };
      },
    };
    for (let i = 0; i < 10; i += 1) await queue();

    const [a, b] = await Promise.all([
      createOutboxProcessor({ db: jobs, mailer, logger }).processBatch(),
      createOutboxProcessor({ db: jobs, mailer, logger }).processBatch(),
    ]);

    expect(a.sent + b.sent).toBe(10);
    expect(sends).toHaveLength(10);
  });

  it('cannot read or change any other table', async () => {
    await expect(jobs.query('SELECT * FROM team_accounts')).rejects.toThrow(/permission denied/);
    await expect(jobs.query('DELETE FROM email_messages')).rejects.toThrow(/permission denied/);
  });
});
