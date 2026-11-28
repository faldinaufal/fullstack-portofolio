// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { describe, expect, it } from 'vitest';
import { AppError } from '../../lib/app-error.js';
import type { DemoInboxRepository } from './repository.js';
import { createDemoInboxService, DEMO_INBOX_PAGE } from './service.js';

const NOW = new Date('2026-11-28T10:00:00Z');

function setup() {
  const calls: Parameters<DemoInboxRepository['latest']>[0][] = [];
  const repository: DemoInboxRepository = {
    latest: async (query) => {
      calls.push(query);
      return [
        {
          id: 'fa1d0000-0000-4000-8000-000000004217',
          toEmail: 'owner@demo.example.com',
          template: 'console.login_code',
          subject: '421700 is your Tempora Console code',
          textBody: 'Your login code is 421700.',
          createdAt: new Date('2026-11-28T09:59:00Z'),
        },
      ];
    },
  };
  const service = createDemoInboxService({
    repository,
    domain: 'demo.example.com',
    now: () => NOW,
  });
  return { service, calls };
}

describe('demo inbox service (FSD 10.3)', () => {
  it('lists the newest emails of the last day, with the demo domain', async () => {
    const { service, calls } = setup();
    const inbox = await service.list(undefined);
    expect(inbox).toEqual({
      domain: 'demo.example.com',
      items: [
        {
          id: 'fa1d0000-0000-4000-8000-000000004217',
          to: 'owner@demo.example.com',
          template: 'console.login_code',
          subject: '421700 is your Tempora Console code',
          text: 'Your login code is 421700.',
          receivedAt: '2026-11-28T09:59:00.000Z',
        },
      ],
    });
    expect(calls).toEqual([
      { to: undefined, since: new Date('2026-11-27T10:00:00Z'), limit: DEMO_INBOX_PAGE },
    ]);
  });

  it('filters by one demo address; an empty filter means all', async () => {
    const { service, calls } = setup();
    await service.list('owner@demo.example.com');
    await service.list('');
    expect(calls.map((c) => c.to)).toEqual(['owner@demo.example.com', undefined]);
  });

  it('refuses addresses outside the demo domain without looking them up', async () => {
    const { service, calls } = setup();
    for (const address of ['owner@example.com', 'owner@demo.example.com.evil.test']) {
      const error = await service.list(address).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(AppError);
      expect(error).toMatchObject({ status: 400, code: 'VALIDATION_FAILED' });
    }
    expect(calls).toEqual([]);
  });
});
