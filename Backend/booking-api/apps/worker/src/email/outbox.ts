// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { EMAIL_MAX_ATTEMPTS, type EmailPayloads, type EmailTemplate } from '@tempora/db/emails';
import type { Logger } from 'pino';
import { isKnownTemplate, renderEmail, type RenderedEmail } from './templates.js';

/** The part of `pg.Pool` the outbox uses, so tests can pass a fake. */
export interface Queryable {
  query<R extends object = Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: R[] }>;
}

export interface Mailer {
  /** `template` lets a mailer keep track of what it delivered (the demo inbox does). */
  send(message: RenderedEmail & { to: string; template: string }): Promise<{ messageId: string }>;
}

interface ClaimedRow {
  id: string;
  to_email: string;
  template: string;
  payload: unknown;
  attempts: number;
}

/** 30 s, 1 min, 2 min, 4 min between attempts (FSD 8.5: exponential back-off). */
export function retryDelayMs(attempt: number): number {
  return 30_000 * 2 ** Math.max(0, attempt - 1);
}

/**
 * Takes due messages and marks them as being worked on in one statement.
 * - `FOR UPDATE SKIP LOCKED`: several workers can poll at once without sending a message twice.
 * - `next_attempt_at` is pushed 5 minutes ahead as a lease: if this worker crashes mid-send,
 *   the message becomes due again and another worker retries it.
 */
/** A scheduled booking email is still right: same booking, still confirmed, same time. */
const STILL_MATCHES = `EXISTS (
  SELECT 1 FROM bookings b
  WHERE b.id = e.booking_id AND b.status = 'confirmed' AND b.starts_at = e.booking_starts_at)`;

/**
 * FSD 6.5: a reminder written for a booking that was cancelled or moved since is not sent.
 * It is kept as `skipped` (the delivery log shows why) and its data is erased like any other.
 */
const SKIP_SQL = `
  UPDATE email_messages AS e
  SET status = 'skipped', payload = NULL, last_error = 'Booking changed before the email was due'
  WHERE status = 'queued' AND next_attempt_at <= now()
    AND booking_id IS NOT NULL AND NOT ${STILL_MATCHES}
  RETURNING e.id`;

const CLAIM_SQL = `
  UPDATE email_messages AS m
  SET attempts = m.attempts + 1, next_attempt_at = now() + interval '5 minutes'
  FROM (
    SELECT id FROM email_messages e
    WHERE status = 'queued' AND next_attempt_at <= now()
      AND (e.booking_id IS NULL OR ${STILL_MATCHES})
    ORDER BY next_attempt_at
    LIMIT $1
    FOR UPDATE SKIP LOCKED
  ) AS due
  WHERE m.id = due.id
  RETURNING m.id, m.to_email, m.template, m.payload, m.attempts`;

export interface OutboxProcessorOptions {
  db: Queryable;
  mailer: Mailer;
  logger: Pick<Logger, 'info' | 'warn' | 'error'>;
  batchSize?: number;
}

/**
 * Sends queued emails from the `email_messages` outbox and records each result.
 * The template data (codes, links) is erased as soon as a message is sent or finally fails.
 */
export function createOutboxProcessor({
  db,
  mailer,
  logger,
  batchSize = 20,
}: OutboxProcessorOptions) {
  async function markSent(id: string, messageId: string) {
    await db.query(
      `UPDATE email_messages
       SET status = 'sent', sent_at = now(), provider_message_id = $2, payload = NULL, last_error = NULL
       WHERE id = $1`,
      [id, messageId.slice(0, 200)],
    );
  }

  async function markFailed(row: ClaimedRow, error: string) {
    const final = row.attempts >= EMAIL_MAX_ATTEMPTS;
    await db.query(
      final
        ? `UPDATE email_messages SET status = 'failed', payload = NULL, last_error = $2 WHERE id = $1`
        : `UPDATE email_messages
           SET next_attempt_at = now() + ($3 || ' milliseconds')::interval, last_error = $2
           WHERE id = $1`,
      final
        ? [row.id, error.slice(0, 500)]
        : [row.id, error.slice(0, 500), retryDelayMs(row.attempts)],
    );
    return final;
  }

  return {
    /** Processes one batch; returns how many messages were sent and failed. */
    async processBatch(): Promise<{ sent: number; failed: number; skipped: number }> {
      // Claim only messages that are still right; then mark the stale ones that are due.
      const { rows } = await db.query<ClaimedRow>(CLAIM_SQL, [batchSize]);
      let sent = 0;
      let failed = 0;

      for (const row of rows) {
        // Logs carry the message ID and template only: never the address, code or link (FSD 8.3).
        const context = { emailId: row.id, template: row.template, attempt: row.attempts };
        try {
          if (!isKnownTemplate(row.template) || row.payload === null) {
            throw new Error(`Cannot render template "${row.template}"`);
          }
          const rendered = renderEmail(
            row.template as EmailTemplate,
            row.payload as EmailPayloads[EmailTemplate],
          );
          const { messageId } = await mailer.send({
            ...rendered,
            to: row.to_email,
            template: row.template,
          });
          await markSent(row.id, messageId);
          sent += 1;
          logger.info(context, 'Email sent');
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          const final = await markFailed(row, message);
          failed += 1;
          (final ? logger.error : logger.warn)({ ...context, err: message, final }, 'Email failed');
        }
      }
      const skipped = (await db.query(SKIP_SQL)).rows.length;
      return { sent, failed, skipped };
    },
  };
}
