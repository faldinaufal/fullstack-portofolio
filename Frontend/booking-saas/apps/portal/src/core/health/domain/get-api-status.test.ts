// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { describe, expect, it } from 'vitest';
import type { ApiStatusRepository } from './api-status';
import { createGetApiStatus } from './get-api-status';

const checkedAt = new Date('2026-11-18T09:30:00.000Z');

describe('getApiStatus use case', () => {
  it('returns the status reported by the repository', async () => {
    const repository: ApiStatusRepository = {
      fetchStatus: async () => ({ state: 'online', version: '1.0.0', checkedAt }),
    };

    await expect(createGetApiStatus(repository)()).resolves.toEqual({
      state: 'online',
      version: '1.0.0',
      checkedAt,
    });
  });

  it('treats any repository failure as offline', async () => {
    const repository: ApiStatusRepository = {
      fetchStatus: async () => {
        throw new Error('network down');
      },
    };

    await expect(createGetApiStatus(repository, () => checkedAt)()).resolves.toEqual({
      state: 'offline',
      version: null,
      checkedAt,
    });
  });
});
