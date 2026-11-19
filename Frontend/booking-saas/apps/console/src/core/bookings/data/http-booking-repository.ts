// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { ApiClient } from '@tempora/api-client';
import {
  AvailabilitySchema,
  CalendarSchema,
  ConsoleBookingDetailSchema,
  ConsoleBookingListSchema,
  type ConsoleBooking,
  type ConsoleBookingDetail,
} from '@tempora/contracts';
import { request } from '../../shared/data/to-request-error';
import type { BookingDetail, BookingRepository, BookingRow } from '../domain/booking';

const C = '/v1/console';

export const toBookingRow = (dto: ConsoleBooking): BookingRow => ({
  ...dto,
  startsAt: new Date(dto.startsAt),
  endsAt: new Date(dto.endsAt),
});

export const toBookingDetail = (dto: ConsoleBookingDetail): BookingDetail => ({
  ...toBookingRow({ ...dto, customer: { name: dto.customer.name, email: dto.customer.email } }),
  customer: dto.customer,
  serviceId: dto.serviceId,
  notes: dto.notes,
  durationMinutes: dto.durationMinutes,
  holdExpiresAt: dto.holdExpiresAt ? new Date(dto.holdExpiresAt) : null,
  cancelReason: dto.cancelReason,
  refundHandledExternally: dto.refundHandledExternally,
  timeZone: dto.timeZone,
  actions: dto.actions,
  timeline: dto.timeline.map((t) => ({
    at: new Date(t.at),
    actor: t.actor,
    action: t.action,
    reason: t.reason,
  })),
});

/** `/v1/console/bookings*` and `/v1/console/calendar` (FSD 5.4). */
export function createHttpBookingRepository(client: ApiClient): BookingRepository {
  const post = (id: string, action: string, body?: object) =>
    request(async () =>
      toBookingDetail(
        await client.post(`${C}/bookings/${id}/${action}`, {
          schema: ConsoleBookingDetailSchema,
          body: body ?? {},
        }),
      ),
    );

  return {
    list: (filters) =>
      request(async () => {
        const params = new URLSearchParams({
          sort: filters.sort,
          page: String(filters.page),
          pageSize: '25',
        });
        for (const key of ['status', 'branchId', 'from', 'to', 'q'] as const) {
          const value = filters[key];
          if (value) params.set(key, value);
        }
        const dto = await client.get(`${C}/bookings?${params}`, {
          schema: ConsoleBookingListSchema,
        });
        return { ...dto, items: dto.items.map(toBookingRow) };
      }),

    get: (id) =>
      request(async () =>
        toBookingDetail(
          await client.get(`${C}/bookings/${id}`, { schema: ConsoleBookingDetailSchema }),
        ),
      ),

    calendar: (range) =>
      request(async () => {
        const params = new URLSearchParams({ from: range.from, to: range.to });
        if (range.branchId) params.set('branchId', range.branchId);
        const dto = await client.get(`${C}/calendar?${params}`, { schema: CalendarSchema });
        return {
          ...dto,
          bookings: dto.bookings.map((b) => ({
            ...b,
            startsAt: new Date(b.startsAt),
            endsAt: new Date(b.endsAt),
            blockedUntil: new Date(b.blockedUntil),
          })),
          timeOff: dto.timeOff.map((t) => ({
            ...t,
            startsAt: new Date(t.startsAt),
            endsAt: new Date(t.endsAt),
          })),
        };
      }),

    slots: (id, query) =>
      request(async () => {
        const dto = await client.get(`${C}/bookings/${id}/slots?${new URLSearchParams(query)}`, {
          schema: AvailabilitySchema,
        });
        return dto.slots.map((s) => ({ startsAt: new Date(s.startsAt) }));
      }),

    reschedule: (id, input) =>
      post(id, 'reschedule', {
        startsAt: input.startsAt.toISOString(),
        ...(input.staffId && { staffId: input.staffId }),
      }),
    reassign: (id, staffId) => post(id, 'reassign', { staffId }),
    cancel: (id, reason) => post(id, 'cancel', reason ? { reason } : {}),
    complete: (id) => post(id, 'complete'),
    noShow: (id) => post(id, 'no-show'),
  };
}
