// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { DEMO_INBOX_LIMIT, DEMO_INBOX_RETENTION_MS, isDemoAddress } from '@tempora/db/emails';
import type { Mailer, Queryable } from './outbox.js';

/**
 * The last step of email delivery on a demo deployment (FSD 10.3). Emails to the demo address
 * domain are stored, already rendered, in `demo_emails` for the public demo inbox; every other
 * address goes to `fallback` (SMTP). Everything before this step (outbox, templates, retries,
 * erasing the payload once sent) is the same as for real email.
 */
export function createDemoInboxMailer({
  db,
  domain,
  fallback,
}: {
  db: Queryable;
  domain: string;
  fallback: Mailer;
}): Mailer {
  return {
    async send(message) {
      if (!isDemoAddress(message.to, domain)) return fallback.send(message);

      const { rows } = await db.query<{ id: string }>(
        `INSERT INTO demo_emails (id, to_email, template, subject, text_body)
         VALUES (gen_random_uuid(), lower($1), $2, left($3, 300), $4)
         RETURNING id`,
        [message.to, message.template, message.subject, message.text],
      );
      // Keep a day of emails and at most the newest DEMO_INBOX_LIMIT (FSD 4.3).
      await db.query(
        `DELETE FROM demo_emails
         WHERE created_at < now() - ($1 || ' milliseconds')::interval
            OR id IN (SELECT id FROM demo_emails ORDER BY created_at DESC, id DESC OFFSET $2)`,
        [DEMO_INBOX_RETENTION_MS, DEMO_INBOX_LIMIT],
      );
      return { messageId: `demo-inbox:${rows[0]!.id}` };
    },
  };
}
