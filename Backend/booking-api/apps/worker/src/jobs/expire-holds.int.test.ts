// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import pg from 'pg';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
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

let tenantId: string;
let slot = 0;

beforeEach(async () => {
  await owner.query('TRUNCATE tenants, team_accounts, audit_logs CASCADE');
  const { rows } = await owner.query<{ id: string }>(
    `WITH t AS (
       INSERT INTO tenants (id, slug, name, invoice_prefix, updated_at)
       VALUES ('fa1d0000-0000-4000-8000-000000004217', 'lumen', 'Lumen Wellness', 'LUM', now())
       RETURNING id)
     SELECT id FROM t`,
  );
  tenantId = rows[0]!.id;
  slot = 0;
});

/** A booking with its invoice and Checkout, in the given state. Returns the booking ID. */
async function booking(
  status: 'pending_payment' | 'confirmed',
  holdMinutesFromNow: number | null,
  invoiceStatus: 'open' | 'paid' = status === 'confirmed' ? 'paid' : 'open',
) {
  slot += 1;
  const { rows } = await owner.query<{ id: string }>(
    `WITH
       acc AS (INSERT INTO team_accounts (id, email, password_hash, name, updated_at)
               VALUES (gen_random_uuid(), 'ines' || $2 || '@veloria.test', 'x', 'Ines Halvorsen', now())
               RETURNING id),
       br  AS (INSERT INTO branches (id, tenant_id, name, updated_at)
               VALUES (gen_random_uuid(), $1, 'Downtown', now()) RETURNING id),
       sv  AS (INSERT INTO services (id, tenant_id, name, duration_minutes, price_cents, updated_at)
               VALUES (gen_random_uuid(), $1, 'Deep Tissue Massage', 60, 4217, now()) RETURNING id),
       ms  AS (INSERT INTO memberships (id, tenant_id, team_account_id, branch_id, role, updated_at)
               SELECT gen_random_uuid(), $1, acc.id, br.id, 'staff', now() FROM acc, br RETURNING id),
       cu  AS (INSERT INTO tenant_customers (id, tenant_id, email, name, updated_at)
               VALUES (gen_random_uuid(), $1, 'omar' || $2 || '@veloria.test', 'Omar Haddad', now())
               RETURNING id),
       bk  AS (INSERT INTO bookings (id, tenant_id, branch_id, service_id, staff_membership_id,
                 tenant_customer_id, starts_at, ends_at, blocked_until, status, hold_expires_at,
                 service_name, duration_minutes, buffer_minutes, price_cents, updated_at)
               SELECT gen_random_uuid(), $1, br.id, sv.id, ms.id, cu.id,
                 now() + interval '3 days', now() + interval '3 days 1 hour',
                 now() + interval '3 days 1 hour', $3::booking_status,
                 CASE WHEN $4::int IS NULL THEN NULL ELSE now() + make_interval(mins => $4::int) END,
                 'Deep Tissue Massage', 60, 0, 4217, now()
               FROM br, sv, ms, cu RETURNING id),
       iv  AS (INSERT INTO invoices (id, tenant_id, booking_id, number, amount_cents, status)
               SELECT gen_random_uuid(), $1, bk.id, 'LUM-2026-' || lpad($2::text, 6, '0'), 4217,
                 $5::invoice_status
               FROM bk RETURNING id),
       py  AS (INSERT INTO payments (id, tenant_id, invoice_id, provider, checkout_session_id,
                 checkout_url, amount_cents, expires_at, status, updated_at)
               SELECT gen_random_uuid(), $1, iv.id, 'demo', 'demo_cs_' || $2, 'http://localhost:3000',
                 4217, now(), CASE WHEN $3 = 'confirmed' THEN 'succeeded' ELSE 'pending' END::payment_status,
                 now()
               FROM iv RETURNING id)
     SELECT bk.id FROM bk, py`,
    [tenantId, slot, status, holdMinutesFromNow, invoiceStatus],
  );
  return rows[0]!.id;
}

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
