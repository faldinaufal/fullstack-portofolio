// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { ApiClient } from '@tempora/api-client';
import {
  AvailabilitySchema,
  PublicBranchDetailSchema,
  PublicTenantSchema,
} from '@tempora/contracts';
import type { BookingRepository } from '../domain/booking';

const P = '/v1/public/tenants';

/** `/v1/public/tenants/:slug/*` (FSD 5.2). */
export function createHttpBookingRepository(client: ApiClient): BookingRepository {
  return {
    getBusiness: (slug) =>
      client.get(`${P}/${encodeURIComponent(slug)}`, { schema: PublicTenantSchema }),

    async getBranch(slug, branchId) {
      const dto = await client.get(`${P}/${encodeURIComponent(slug)}/branches/${branchId}`, {
        schema: PublicBranchDetailSchema,
      });
      const { tenant, ...branch } = dto;
      return { ...branch, business: tenant };
    },

    async getSlots(slug, query) {
      const params = new URLSearchParams({
        branchId: query.branchId,
        serviceId: query.serviceId,
        staffId: query.staffId,
        date: query.date,
      });
      const dto = await client.get(`${P}/${encodeURIComponent(slug)}/availability?${params}`, {
        schema: AvailabilitySchema,
      });
      return dto.slots.map((slot) => ({
        startsAt: new Date(slot.startsAt),
        endsAt: new Date(slot.endsAt),
      }));
    },
  };
}
