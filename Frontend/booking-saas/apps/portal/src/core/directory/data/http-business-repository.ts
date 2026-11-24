// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { ApiClient } from '@tempora/api-client';
import { DirectorySchema, type DirectoryEntry } from '@tempora/contracts';
import type { Business, BusinessRepository } from '../domain/business';

/** "Deep Tissue Massage, Sports Physiotherapy +2 more" */
export function summarizeOffering(serviceNames: string[]): string {
  if (serviceNames.length === 0) return 'Services coming soon';
  const shown = serviceNames.slice(0, 2).join(', ');
  const rest = serviceNames.length - 2;
  return rest > 0 ? `${shown} +${rest} more` : shown;
}

export const toBusiness = (entry: DirectoryEntry): Business => ({
  id: entry.slug,
  slug: entry.slug,
  name: entry.name,
  offering: summarizeOffering(entry.serviceNames),
  serviceNames: entry.serviceNames,
  branchNames: entry.branchNames,
  logoUrl: entry.logoUrl,
});

/** `GET /v1/public/tenants`: the live directory. */
export function createHttpBusinessRepository(client: ApiClient): BusinessRepository {
  return {
    async search(query) {
      const path = query
        ? `/v1/public/tenants?q=${encodeURIComponent(query)}`
        : '/v1/public/tenants';
      const directory = await client.get(path, { schema: DirectorySchema });
      return directory.items.map(toBusiness);
    },
  };
}
