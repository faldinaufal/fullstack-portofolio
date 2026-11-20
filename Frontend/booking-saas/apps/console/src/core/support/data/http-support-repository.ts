// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { ApiClient } from '@tempora/api-client';
import {
  SupportGrantListSchema,
  type SupportGrant as SupportGrantDto,
  type SupportGrantList,
} from '@tempora/contracts';
import { request } from '../../shared/data/to-request-error';
import type { SupportGrant, SupportGrants, SupportRepository } from '../domain/support';

const BASE = '/v1/console/support-grants';

export const toGrant = (dto: SupportGrantDto): SupportGrant => ({
  ...dto,
  startsAt: new Date(dto.startsAt),
  expiresAt: new Date(dto.expiresAt),
  revokedAt: dto.revokedAt ? new Date(dto.revokedAt) : null,
});

export const toGrants = (dto: SupportGrantList): SupportGrants => ({
  active: dto.active && toGrant(dto.active),
  items: dto.items.map(toGrant),
});

/** `/v1/console/support-grants*` (FSD 5.4), owner only. */
export function createHttpSupportRepository(client: ApiClient): SupportRepository {
  return {
    grants: () =>
      request(async () => toGrants(await client.get(BASE, { schema: SupportGrantListSchema }))),
    grant: (durationHours) =>
      request(async () =>
        toGrants(
          await client.post(BASE, { schema: SupportGrantListSchema, body: { durationHours } }),
        ),
      ),
    revoke: (id) =>
      request(async () =>
        toGrants(
          await client.request(`${BASE}/${id}`, {
            method: 'DELETE',
            schema: SupportGrantListSchema,
          }),
        ),
      ),
  };
}
