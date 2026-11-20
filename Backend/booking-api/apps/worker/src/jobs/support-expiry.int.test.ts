// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import pg from 'pg';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { bookingFixture } from '../test/booking-fixture.js';
import { recordSupportExpiry } from './support-expiry.js';

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
beforeEach(async () => {
  await fixture.reset();
  await owner.query('TRUNCATE support_grants');
});

/** A grant of one hour that started `startedHoursAgo` hours ago; revoked if asked. */
async function grant(startedHoursAgo: number, revoked = false) {
  const booking = await fixture.booking('confirmed', null);
  const { rows } = await owner.query<{ id: string }>(
    `INSERT INTO support_grants (id, tenant_id, granted_by_membership_id, starts_at, expires_at, revoked_at)
     SELECT gen_random_uuid(), tenant_id, staff_membership_id,
       now() - make_interval(hours => $2), now() - make_interval(hours => $2) + interval '1 hour',
       CASE WHEN $3 THEN now() - make_interval(hours => $2) + interval '30 minutes' END
     FROM bookings WHERE id = $1
     RETURNING id`,
    [booking, startedHoursAgo, revoked],
  );
  return rows[0]!.id;
}

describe('support expiry job (FSD 1.4, as tempora_jobs)', () => {
  it('records each expiry once; active and revoked grants are left alone', async () => {
    const expired = await grant(2);
    const active = await grant(0);
    const revoked = await grant(3, true);

    expect(await recordSupportExpiry(jobs)).toBe(1);
    expect(await recordSupportExpiry(jobs)).toBe(0);

    const { rows } = await owner.query<{ entity_id: string; actor_type: string; action: string }>(
      `SELECT entity_id, actor_type, action FROM audit_logs WHERE entity_type = 'support_grant'`,
    );
    expect(rows).toEqual([{ entity_id: expired, actor_type: 'system', action: 'support.expired' }]);
    const recorded = await owner.query<{ id: string }>(
      'SELECT id FROM support_grants WHERE expiry_recorded_at IS NOT NULL',
    );
    expect(recorded.rows.map((r) => r.id)).toEqual([expired]);
    expect([active, revoked]).not.toContain(expired);
  });

  it('may change nothing but the recorded time', async () => {
    const id = await grant(2);
    await expect(
      jobs.query(`UPDATE support_grants SET revoked_at = now() WHERE id = $1`, [id]),
    ).rejects.toThrow(/permission denied/);
    await expect(jobs.query(`DELETE FROM support_grants WHERE id = $1`, [id])).rejects.toThrow(
      /permission denied/,
    );
  });
});
