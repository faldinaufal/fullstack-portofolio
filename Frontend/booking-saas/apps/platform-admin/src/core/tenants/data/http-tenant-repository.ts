// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { ApiClient } from '@tempora/api-client';
import {
  AdminTenantDetailSchema,
  AdminTenantListSchema,
  PlatformAuditListSchema,
  type AdminTenant,
  type AdminTenantDetail,
} from '@tempora/contracts';
import { request } from '../../shared/data/to-request-error';
import type { Tenant, TenantDetail, TenantRepository } from '../domain/tenant';

const A = '/v1/admin';

export const toTenant = (dto: AdminTenant): Tenant => ({
  ...dto,
  createdAt: new Date(dto.createdAt),
});

export const toTenantDetail = (dto: AdminTenantDetail): TenantDetail => ({
  ...toTenant(dto),
  invoicePrefix: dto.invoicePrefix,
  suspendedAt: dto.suspendedAt ? new Date(dto.suspendedAt) : null,
  suspensionReason: dto.suspensionReason,
  owner: dto.owner,
  ownerInvitation: dto.ownerInvitation && {
    ...dto.ownerInvitation,
    expiresAt: new Date(dto.ownerInvitation.expiresAt),
  },
  supportAccess: dto.supportAccess && {
    startsAt: new Date(dto.supportAccess.startsAt),
    expiresAt: new Date(dto.supportAccess.expiresAt),
  },
});

/** `/v1/admin/tenants*` and `/v1/admin/audit-logs` (FSD 5.5). */
export function createHttpTenantRepository(client: ApiClient): TenantRepository {
  const detail = (path: string, body?: object) =>
    request(async () =>
      toTenantDetail(
        await client.post(`${A}${path}`, { schema: AdminTenantDetailSchema, body: body ?? {} }),
      ),
    );
  return {
    list: (query) =>
      request(async () => {
        const params = new URLSearchParams({ page: String(query.page), pageSize: '25' });
        if (query.q) params.set('q', query.q);
        if (query.status) params.set('status', query.status);
        const dto = await client.get(`${A}/tenants?${params}`, { schema: AdminTenantListSchema });
        return { ...dto, items: dto.items.map(toTenant) };
      }),
    get: (id) =>
      request(async () =>
        toTenantDetail(await client.get(`${A}/tenants/${id}`, { schema: AdminTenantDetailSchema })),
      ),
    create: (input) => detail('/tenants', input),
    suspend: (id, reason) => detail(`/tenants/${id}/suspend`, { reason }),
    reactivate: (id) => detail(`/tenants/${id}/reactivate`),
    audit: (page) =>
      request(async () => {
        const dto = await client.get(`${A}/audit-logs?page=${page}&pageSize=50`, {
          schema: PlatformAuditListSchema,
        });
        return {
          total: dto.total,
          pageSize: dto.pageSize,
          items: dto.items.map((item) => ({
            id: item.id,
            at: new Date(item.at),
            actor: item.actor,
            action: item.action,
            entityId: item.entityId,
            reason: item.reason,
            after: item.after,
          })),
        };
      }),
  };
}
