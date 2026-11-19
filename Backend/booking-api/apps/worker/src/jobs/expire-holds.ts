// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { Logger } from 'pino';
import type { Queryable } from '../email/outbox.js';

/**
 * Releases unpaid holds that have run out (FSD 6.4 hold-expiry job), in one statement so
 * every step happens together or not at all:
 * - booking `pending_payment` → `expired` (the slot is free again);
 * - its open invoice → `void`, its pending Checkout → `expired`;
 * - an audit entry per booking, with the system as actor.
 * The conditions repeat the state checks, so running it twice, or at the same time as the
 * API or a webhook releasing the same hold, changes nothing the second time.
 */
const EXPIRE_HOLDS_SQL = `
  WITH expired AS (
    UPDATE bookings
    SET status = 'expired', version = version + 1, updated_at = now()
    WHERE status = 'pending_payment' AND hold_expires_at <= now()
    RETURNING id, tenant_id, branch_id
  ),
  voided AS (
    UPDATE invoices
    SET status = 'void', voided_at = now(), void_reason = 'Payment hold expired'
    WHERE booking_id IN (SELECT id FROM expired) AND status = 'open'
    RETURNING id
  ),
  payments_expired AS (
    UPDATE payments
    SET status = 'expired', updated_at = now()
    WHERE invoice_id IN (SELECT id FROM voided) AND status = 'pending'
  ),
  audited AS (
    INSERT INTO audit_logs
      (id, tenant_id, branch_id, actor_type, actor_label, action, entity_type, entity_id, after, reason, created_at)
    SELECT gen_random_uuid(), tenant_id, branch_id, 'system', 'Hold expiry job', 'booking.expired',
           'booking', id, '{"status":"expired"}'::jsonb, 'Payment hold expired', now()
    FROM expired
  )
  -- Counted from the bookings, not with INSERT … RETURNING: that would need read access to
  -- the audit log, and the worker may only append to it.
  SELECT count(*)::int AS released FROM expired`;

export async function expireHolds(db: Queryable): Promise<number> {
  const { rows } = await db.query<{ released: number }>(EXPIRE_HOLDS_SQL);
  return rows[0]?.released ?? 0;
}

export function createExpireHoldsHandler(db: Queryable, logger: Pick<Logger, 'info'>) {
  return async () => {
    const released = await expireHolds(db);
    if (released > 0) logger.info({ released }, 'Released expired payment holds');
  };
}
