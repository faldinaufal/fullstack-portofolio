// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { Logger } from 'pino';
import type { Queryable } from '../email/outbox.js';

/**
 * FSD 6.7 auto-complete: a confirmed session that ended more than 24 hours ago and was not
 * marked by the team becomes `completed`, with the system as actor in the audit log. One
 * statement, so it is all or nothing; the status condition makes a second run (or a team
 * member marking it at the same time) change nothing.
 */
const AUTO_COMPLETE_SQL = `
  WITH done AS (
    UPDATE bookings
    SET status = 'completed', marked_at = now(), version = version + 1, updated_at = now()
    WHERE status = 'confirmed' AND ends_at < now() - interval '24 hours'
    RETURNING id, tenant_id, branch_id
  ),
  audited AS (
    INSERT INTO audit_logs
      (id, tenant_id, branch_id, actor_type, actor_label, action, entity_type, entity_id, before, after, reason, created_at)
    SELECT gen_random_uuid(), tenant_id, branch_id, 'system', 'Auto-complete job', 'booking.completed',
           'booking', id, '{"status":"confirmed"}'::jsonb, '{"status":"completed"}'::jsonb,
           'Not marked within 24 hours of the session', now()
    FROM done
  )
  SELECT count(*)::int AS completed FROM done`;

export async function autoComplete(db: Queryable): Promise<number> {
  const { rows } = await db.query<{ completed: number }>(AUTO_COMPLETE_SQL);
  return rows[0]?.completed ?? 0;
}

export function createAutoCompleteHandler(db: Queryable, logger: Pick<Logger, 'info'>) {
  return async () => {
    const completed = await autoComplete(db);
    if (completed > 0) logger.info({ completed }, 'Auto-completed past bookings');
  };
}
