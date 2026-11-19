// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type pg from 'pg';

/**
 * Bookings inserted directly as the owner, for worker tests: one business, and one booking
 * (with its therapist, customer, invoice and Checkout) per call.
 */
export function bookingFixture(owner: pg.Pool) {
  const state = { tenantId: '', slot: 0 };
  return {
    get tenantId() {
      return state.tenantId;
    },

    async reset() {
      await owner.query('TRUNCATE tenants, team_accounts, audit_logs, email_messages CASCADE');
      const { rows } = await owner.query<{ id: string }>(
        `INSERT INTO tenants (id, slug, name, invoice_prefix, updated_at)
         VALUES ('fa1d0000-0000-4000-8000-000000004217', 'lumen', 'Lumen Wellness', 'LUM', now())
         RETURNING id`,
      );
      state.tenantId = rows[0]!.id;
      state.slot = 0;
    },

    /** A booking with its invoice and Checkout, in the given state. Returns the booking ID. */
    async booking(
      status: 'pending_payment' | 'confirmed',
      holdMinutesFromNow: number | null,
      invoiceStatus: 'open' | 'paid' = status === 'confirmed' ? 'paid' : 'open',
    ) {
      state.slot += 1;
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
        [state.tenantId, state.slot, status, holdMinutesFromNow, invoiceStatus],
      );
      return rows[0]!.id;
    },
  };
}
