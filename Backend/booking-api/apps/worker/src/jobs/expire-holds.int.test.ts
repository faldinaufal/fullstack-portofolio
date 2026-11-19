// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import pg from 'pg';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { bookingFixture } from '../test/booking-fixture.js';
import { expireHolds } from './expire-holds.js';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} must be set for integration tests.`);
  return value;
}

// The worker's own role, with exactly the rights the migration grants it.
const jobs = new pg.Pool({ connectionString: requireEnv('TEST_JOBS_DATABASE_URL'), max: 2 });
// Owner: inserts fixtures and reads results.
const owner = new pg.Pool({ connectionString: requireEnv('TEST_DATABASE_OWNER_URL'), max: 2 });

afterAll(async () => {
  await jobs.end();
  await owner.end();
});

const fixture = bookingFixture(owner);
const booking = fixture.booking.bind(fixture);

beforeEach(() => fixture.reset());

async function state(bookingId: string) {
  const { rows } = await owner.query<{
    booking: string;
    invoice: string;
    void_reason: string | null;
    payment: string;
  }>(
    `SELECT b.status AS booking, i.status AS invoice, i.void_reason, p.status AS payment
     FROM bookings b JOIN invoices i ON i.booking_id = b.id JOIN payments p ON p.invoice_id = i.id
     WHERE b.id = $1`,
    [bookingId],
  );
  return rows[0]!;
}

describe('hold expiry job (FSD 6.4, as tempora_jobs)', () => {
  it('releases a hold that ran out: booking expired, invoice void, Checkout expired, audited', async () => {
    const stale = await booking('pending_payment', -1);
    expect(await expireHolds(jobs)).toBe(1);

    expect(await state(stale)).toEqual({
      booking: 'expired',
      invoice: 'void',
      void_reason: 'Payment hold expired',
      payment: 'expired',
    });
    const { rows } = await owner.query(
      `SELECT actor_type, action, entity_id FROM audit_logs WHERE entity_id = $1`,
      [stale],
    );
    expect(rows).toEqual([{ actor_type: 'system', action: 'booking.expired', entity_id: stale }]);
  });

  it('leaves live holds and confirmed bookings alone', async () => {
    const live = await booking('pending_payment', 10);
    const confirmed = await booking('confirmed', null);
    expect(await expireHolds(jobs)).toBe(0);
    expect((await state(live)).booking).toBe('pending_payment');
    expect(await state(confirmed)).toMatchObject({ booking: 'confirmed', invoice: 'paid' });
  });

  it('never voids an invoice that is no longer open (defence in depth)', async () => {
    const odd = await booking('pending_payment', -1, 'paid');
    await expireHolds(jobs);
    expect(await state(odd)).toMatchObject({ booking: 'expired', invoice: 'paid' });
  });

  it('is safe to run twice, or twice at the same time', async () => {
    await booking('pending_payment', -5);
    await booking('pending_payment', -1);
    const [a, b] = await Promise.all([expireHolds(jobs), expireHolds(jobs)]);
    expect(a + b).toBe(2);
    expect(await expireHolds(jobs)).toBe(0);
    const { rows } = await owner.query(`SELECT count(*)::int AS n FROM audit_logs`);
    expect(rows[0].n).toBe(2);
  });
});
