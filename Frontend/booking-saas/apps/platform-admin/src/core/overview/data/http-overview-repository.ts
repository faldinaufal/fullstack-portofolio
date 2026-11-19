// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { ApiClient } from '@tempora/api-client';
import { AdminOverviewSchema } from '@tempora/contracts';
import { request } from '../../shared/data/to-request-error';
import type { OverviewRepository } from '../domain/overview';

/** `GET /v1/admin/overview` (FSD 5.5). */
export function createHttpOverviewRepository(client: ApiClient): OverviewRepository {
  return {
    get: () => request(() => client.get('/v1/admin/overview', { schema: AdminOverviewSchema })),
  };
}
