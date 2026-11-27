// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { ApiClient } from '@tempora/api-client';
import { DemoInboxSchema, type DemoInbox as DemoInboxDto } from '@tempora/contracts';
import { request } from '../../shared/data/to-request-error';
import type { DemoInbox, DemoInboxRepository } from '../domain/demo-inbox';

export const toDemoInbox = (dto: DemoInboxDto): DemoInbox => ({
  domain: dto.domain,
  items: dto.items.map((item) => ({ ...item, receivedAt: new Date(item.receivedAt) })),
});

/** `GET /v1/public/demo-inbox` (FSD 5.2). */
export function createHttpDemoInboxRepository(client: ApiClient): DemoInboxRepository {
  return {
    list: (to) =>
      request(async () => {
        const query = to ? `?${new URLSearchParams({ to })}` : '';
        return toDemoInbox(
          await client.get(`/v1/public/demo-inbox${query}`, { schema: DemoInboxSchema }),
        );
      }),
  };
}
