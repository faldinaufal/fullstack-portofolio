// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { Logger } from 'pino';
import type { Queryable } from '../email/outbox.js';

/**
 * FSD 1.4: a support grant's expiry is written to the tenant's audit log, like its creation
 * and revocation. The grant already stops working at `expires_at` (RLS checks the time); this
 * job only records it, once per grant (`expiry_recorded_at`), with the system as actor.
 * A revoked grant did not expire, so it is left alone.
 */
const SUPPORT_EXPIRY_SQL = `
  WITH ended AS (
    UPDATE support_grants SET expiry_recorded_at = now()
    WHERE revoked_at IS NULL AND expires_at <= now() AND expiry_recorded_at IS NULL
    RETURNING id, tenant_id, expires_at
  ),
  audited AS (
    INSERT INTO audit_logs
      (id, tenant_id, actor_type, actor_label, action, entity_type, entity_id, after, created_at)
    SELECT gen_random_uuid(), tenant_id, 'system', 'Support access', 'support.expired',
           'support_grant', id, jsonb_build_object('expiresAt', expires_at), now()
    FROM ended
  )
  SELECT count(*)::int AS expired FROM ended`;

export async function recordSupportExpiry(db: Queryable): Promise<number> {
  const { rows } = await db.query<{ expired: number }>(SUPPORT_EXPIRY_SQL);
  return rows[0]?.expired ?? 0;
}

export function createSupportExpiryHandler(db: Queryable, logger: Pick<Logger, 'info'>) {
  return async () => {
    const expired = await recordSupportExpiry(db);
    if (expired > 0) logger.info({ expired }, 'Recorded expired support grants');
  };
}
