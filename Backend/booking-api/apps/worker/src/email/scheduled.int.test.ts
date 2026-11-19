// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import pg from 'pg';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { bookingFixture } from '../test/booking-fixture.js';
import { createOutboxProcessor, type Mailer } from './outbox.js';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} must be set for integration tests.`);
  return value;
}

// The worker's own role, with exactly the rights the migrations grant it.
const jobs = new pg.Pool({ connectionString: requireEnv('TEST_JOBS_DATABASE_URL'), max: 2 });
const owner = new pg.Pool({ connectionString: requireEnv('TEST_DATABASE_OWNER_URL'), max: 2 });
const fixture = bookingFixture(owner);
const logger = { info: () => {}, warn: () => {}, error: () => {} };

afterAll(async () => {
  await jobs.end();
  await owner.end();
});
beforeEach(() => fixture.reset());

const details = {
  name: 'Omar Haddad',
  businessName: 'Lumen Wellness',
  serviceName: 'Deep Tissue Massage',
  therapist: 'Ines H.',
  when: 'Monday 23 November 2026 at 10:00',
  branchName: 'Downtown',
  address: null,
  bookingUrl: 'http://localhost:3000/manage/token',
};

/** A reminder for the booking's current start time, due `dueInMinutes` from now. */
async function reminder(bookingId: string, dueInMinutes = -1) {
  const { rows } = await owner.query<{ id: string }>(
    `INSERT INTO email_messages
       (id, tenant_id, to_email, template, payload, next_attempt_at, booking_id, booking_starts_at)
     SELECT gen_random_uuid(), b.tenant_id, 'omar@veloria.test', 'portal.booking_reminder', $2,
            now() + make_interval(mins => $3), b.id, b.starts_at
     FROM bookings b WHERE b.id = $1
     RETURNING id`,
    [bookingId, JSON.stringify(details), dueInMinutes],
  );
  return rows[0]!.id;
}

async function row(id: string) {
  const { rows } = await owner.query<{ status: string; payload: unknown }>(
    'SELECT status, payload FROM email_messages WHERE id = $1',
    [id],
  );
  return rows[0]!;
}

function recordingMailer() {
  const sent: string[] = [];
  const mailer: Mailer = {
    send: async (message) => {
      sent.push(message.subject);
      return { messageId: '<test@mailpit>' };
    },
  };
  return { sent, mailer };
}

describe('scheduled booking emails (FSD 6.5, as tempora_jobs)', () => {
  it('sends a due reminder while the booking still matches', async () => {
    const id = await reminder(await fixture.booking('confirmed', null));
    const { sent, mailer } = recordingMailer();
    expect(await createOutboxProcessor({ db: jobs, mailer, logger }).processBatch()).toEqual({
      sent: 1,
      failed: 0,
      skipped: 0,
    });
    expect(sent[0]).toContain('Reminder');
    expect(await row(id)).toMatchObject({ status: 'sent', payload: null });
  });

  it('skips the reminder of a booking that was moved or cancelled, and erases its data', async () => {
    const moved = await fixture.booking('confirmed', null);
    const cancelled = await fixture.booking('confirmed', null);
    const forMoved = await reminder(moved);
    const forCancelled = await reminder(cancelled);
    await owner.query(
      `UPDATE bookings SET starts_at = starts_at + interval '1 hour',
         ends_at = ends_at + interval '1 hour', blocked_until = blocked_until + interval '1 hour'
       WHERE id = $1`,
      [moved],
    );
    await owner.query(
      `UPDATE bookings SET status = 'cancelled', cancelled_at = now(), cancelled_by_type = 'owner'
       WHERE id = $1`,
      [cancelled],
    );

    const { sent, mailer } = recordingMailer();
    expect(await createOutboxProcessor({ db: jobs, mailer, logger }).processBatch()).toEqual({
      sent: 0,
      failed: 0,
      skipped: 2,
    });
    expect(sent).toEqual([]);
    expect(await row(forMoved)).toEqual({ status: 'skipped', payload: null });
    expect(await row(forCancelled)).toEqual({ status: 'skipped', payload: null });
  });

  it('leaves a reminder that is not due yet alone', async () => {
    const id = await reminder(await fixture.booking('confirmed', null), 60);
    const { sent, mailer } = recordingMailer();
    await createOutboxProcessor({ db: jobs, mailer, logger }).processBatch();
    expect(sent).toEqual([]);
    expect((await row(id)).status).toBe('queued');
  });
});
