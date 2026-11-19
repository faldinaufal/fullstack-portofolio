// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import pg from 'pg';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { bookingFixture } from '../test/booking-fixture.js';
import { autoComplete } from './auto-complete.js';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} must be set for integration tests.`);
  return value;
}

const jobs = new pg.Pool({ connectionString: requireEnv('TEST_JOBS_DATABASE_URL'), max: 2 });
const owner = new pg.Pool({ connectionString: requireEnv('TEST_DATABASE_OWNER_URL'), max: 2 });
const fixture = bookingFixture(owner);

afterAll(async () => {
  await jobs.end();
  await owner.end();
});
beforeEach(() => fixture.reset());

/** Moves a booking so that it ended `hoursAgo` hours ago. */
async function endedAgo(id: string, hoursAgo: number) {
  await owner.query(
    `UPDATE bookings SET starts_at = now() - make_interval(hours => $2 + 1),
       ends_at = now() - make_interval(hours => $2), blocked_until = now() - make_interval(hours => $2)
     WHERE id = $1`,
    [id, hoursAgo],
  );
}

const statusOf = async (id: string) =>
  (
    await owner.query<{ status: string; marked_at: Date | null }>(
      'SELECT status, marked_at FROM bookings WHERE id = $1',
      [id],
    )
  ).rows[0]!;

describe('auto-complete job (FSD 6.7, as tempora_jobs)', () => {
  it('completes confirmed sessions that ended over 24 h ago, once, audited', async () => {
    const old = await fixture.booking('confirmed', null);
    const recent = await fixture.booking('confirmed', null);
    await endedAgo(old, 25);
    await endedAgo(recent, 2);

    expect(await autoComplete(jobs)).toBe(1);
    expect(await autoComplete(jobs)).toBe(0);
    expect(await statusOf(old)).toMatchObject({ status: 'completed' });
    expect((await statusOf(old)).marked_at).not.toBeNull();
    expect((await statusOf(recent)).status).toBe('confirmed');

    const { rows } = await owner.query(
      `SELECT actor_type, action FROM audit_logs WHERE entity_id = $1`,
      [old],
    );
    expect(rows).toEqual([{ actor_type: 'system', action: 'booking.completed' }]);
  });

  it('leaves no-shows, cancelled and unpaid bookings alone', async () => {
    const unpaid = await fixture.booking('pending_payment', 10);
    await endedAgo(unpaid, 30);
    expect(await autoComplete(jobs)).toBe(0);
    expect((await statusOf(unpaid)).status).toBe('pending_payment');
  });
});
