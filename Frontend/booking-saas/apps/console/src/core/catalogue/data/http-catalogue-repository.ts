// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { ApiClient } from '@tempora/api-client';
import { ServiceListSchema, ServiceSchema, TenantSettingsSchema } from '@tempora/contracts';
import { request } from '../../shared/data/to-request-error';
import type { CatalogueRepository } from '../domain/catalogue';

const C = '/v1/console';

export function createHttpCatalogueRepository(client: ApiClient): CatalogueRepository {
  return {
    getSettings: () => request(() => client.get(`${C}/tenant`, { schema: TenantSettingsSchema })),

    updateSettings: (version, input) =>
      request(() =>
        client.request(`${C}/tenant`, {
          method: 'PATCH',
          schema: TenantSettingsSchema,
          body: input,
          headers: { 'If-Match': String(version) },
        }),
      ),

    listServices: () =>
      request(async () => (await client.get(`${C}/services`, { schema: ServiceListSchema })).items),

    createService: (input) =>
      request(() => client.post(`${C}/services`, { schema: ServiceSchema, body: input })),

    updateService: (id, version, input) =>
      request(() =>
        client.request(`${C}/services/${id}`, {
          method: 'PATCH',
          schema: ServiceSchema,
          body: input,
          headers: { 'If-Match': String(version) },
        }),
      ),

    archiveService: (id) =>
      request(() => client.post(`${C}/services/${id}/archive`, { schema: ServiceSchema })),
  };
}
