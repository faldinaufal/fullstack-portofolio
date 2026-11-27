// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { DemoInbox } from '@tempora/contracts';
import { DEMO_INBOX_RETENTION_MS, isDemoAddress } from '@tempora/db/emails';
import { AppError } from '../../lib/app-error.js';
import type { DemoInboxRepository } from './repository.js';

/** The page shows the newest emails only; codes expire in minutes anyway. */
export const DEMO_INBOX_PAGE = 50;

export interface DemoInboxServiceDependencies {
  repository: DemoInboxRepository;
  /** `DEMO_EMAIL_DOMAIN`, e.g. `demo.example.com`. */
  domain: string;
  now?: () => Date;
}

/**
 * The public demo inbox (FSD 10.3). It exists only with DEMO_MODE on: the app registers the
 * route only then, so without it the path answers 404 like any unknown path.
 */
export function createDemoInboxService({
  repository,
  domain,
  now = () => new Date(),
}: DemoInboxServiceDependencies) {
  return {
    async list(to: string | undefined): Promise<DemoInbox> {
      const address = to === '' ? undefined : to;
      // Only the demo domain has an inbox; anything else is a mistake in the link, not a
      // reason to say whether some other address exists.
      if (address !== undefined && !isDemoAddress(address, domain)) {
        throw new AppError({
          status: 400,
          code: 'VALIDATION_FAILED',
          title: 'Invalid request',
          detail: `Only addresses at ${domain} have a demo inbox.`,
          errors: [{ path: 'to', message: `Use an address at ${domain}.` }],
        });
      }
      const rows = await repository.latest({
        to: address,
        since: new Date(now().getTime() - DEMO_INBOX_RETENTION_MS),
        limit: DEMO_INBOX_PAGE,
      });
      return {
        domain,
        items: rows.map((row) => ({
          id: row.id,
          to: row.toEmail,
          subject: row.subject,
          text: row.textBody,
          receivedAt: row.createdAt.toISOString(),
        })),
      };
    },
  };
}

export type DemoInboxService = ReturnType<typeof createDemoInboxService>;
