// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { createTransport } from 'nodemailer';
import type { Mailer } from './outbox.js';

/**
 * SMTP delivery. Locally `SMTP_URL` points at Mailpit (a fake inbox at http://localhost:8025);
 * in production it points at the transactional email provider's SMTP endpoint, so the same
 * code runs everywhere.
 */
export function createSmtpMailer({ url, from }: { url: string; from: string }): Mailer {
  const transport = createTransport(url);
  return {
    async send({ to, subject, text, html }) {
      const info = await transport.sendMail({ from, to, subject, text, html });
      return { messageId: info.messageId };
    },
  };
}
