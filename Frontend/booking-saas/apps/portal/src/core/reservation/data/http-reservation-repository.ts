// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { ApiClient } from '@tempora/api-client';
import {
  AvailabilitySchema,
  BookingCreatedSchema,
  CheckoutLinkSchema,
  PortalBookingDetailSchema,
  PortalBookingListSchema,
  PortalInvoiceListSchema,
  PortalInvoiceSchema,
  type PortalBooking,
  type PortalBookingDetail,
  type PortalInvoice,
} from '@tempora/contracts';
import { z } from 'zod';
import { request } from '../../shared/data/to-request-error';
import type { DemoCheckoutRepository } from '../domain/demo-checkout';
import type {
  Invoice,
  Reservation,
  ReservationRepository,
  ReservationSummary,
} from '../domain/reservation';

const PT = '/v1/portal';

/** `Authorization: Guest <token>` when this tab holds the booking's access token. */
const guest = (token: string | null): Record<string, string> =>
  token ? { Authorization: `Guest ${token}` } : {};

export function toReservationSummary(dto: PortalBooking): ReservationSummary {
  return {
    id: dto.id,
    status: dto.status,
    business: dto.business,
    branchName: dto.branchName,
    serviceName: dto.serviceName,
    therapist: dto.therapist,
    startsAt: new Date(dto.startsAt),
    endsAt: new Date(dto.endsAt),
    priceCents: dto.priceCents,
    timeZone: dto.timeZone,
    invoiceNumber: dto.invoiceNumber,
  };
}

export function toReservation(dto: PortalBookingDetail): Reservation {
  return {
    ...toReservationSummary(dto),
    branchId: dto.branchId,
    serviceId: dto.serviceId,
    staffId: dto.staffId,
    branchAddress: dto.branchAddress,
    notes: dto.notes,
    invoice: {
      ...dto.invoice,
      issuedAt: new Date(dto.invoice.issuedAt),
      paidAt: dto.invoice.paidAt ? new Date(dto.invoice.paidAt) : null,
    },
    payBy: dto.payBy ? new Date(dto.payBy) : null,
    actions: dto.actions,
    rescheduling: dto.rescheduling && {
      remaining: dto.rescheduling.remaining,
      until: new Date(dto.rescheduling.until),
    },
  };
}

const optionalDate = (value: string | null) => (value ? new Date(value) : null);

export function toInvoice(dto: PortalInvoice): Invoice {
  return {
    reservationId: dto.bookingId,
    number: dto.number,
    status: dto.status,
    currency: dto.currency,
    amountCents: dto.amountCents,
    issuedAt: new Date(dto.issuedAt),
    paidAt: optionalDate(dto.paidAt),
    voidedAt: optionalDate(dto.voidedAt),
    voidReason: dto.voidReason,
    business: dto.business,
    branch: dto.branch,
    billedTo: dto.billedTo,
    line: { ...dto.line, startsAt: new Date(dto.line.startsAt) },
    timeZone: dto.timeZone,
  };
}

/** `/v1/portal/bookings*` and `/v1/portal/guest/booking` (FSD 5.3). */
export function createHttpReservationRepository(client: ApiClient): ReservationRepository {
  return {
    create: (input, idempotencyKey) =>
      request(async () => {
        const dto = await client.post(`${PT}/bookings`, {
          schema: BookingCreatedSchema,
          headers: { 'Idempotency-Key': idempotencyKey },
          body: {
            tenantSlug: input.tenantSlug,
            branchId: input.branchId,
            serviceId: input.serviceId,
            staffId: input.staffId,
            startsAt: input.startsAt.toISOString(),
            ...(input.notes && { notes: input.notes }),
            ...(input.guest && { guest: input.guest }),
          },
        });
        return {
          reservation: toReservationSummary(dto.booking),
          checkoutUrl: dto.checkoutUrl,
          accessToken: dto.accessToken,
        };
      }),

    get: (id, token) =>
      request(async () =>
        toReservation(
          await client.get(`${PT}/bookings/${id}`, {
            schema: PortalBookingDetailSchema,
            headers: guest(token),
          }),
        ),
      ),

    getByLink: (token) =>
      request(async () =>
        toReservation(
          await client.get(`${PT}/guest/booking`, {
            schema: PortalBookingDetailSchema,
            headers: guest(token),
          }),
        ),
      ),

    list: (when, page) =>
      request(async () => {
        const dto = await client.get(`${PT}/bookings?when=${when}&page=${page}&pageSize=20`, {
          schema: PortalBookingListSchema,
        });
        return { ...dto, items: dto.items.map(toReservationSummary) };
      }),

    resumePayment: (id, token) =>
      request(async () => {
        const dto = await client.post(`${PT}/bookings/${id}/checkout`, {
          schema: CheckoutLinkSchema,
          headers: guest(token),
        });
        return dto.checkoutUrl;
      }),

    cancel: (id, token) =>
      request(async () =>
        toReservation(
          await client.post(`${PT}/bookings/${id}/cancel`, {
            schema: PortalBookingDetailSchema,
            headers: guest(token),
          }),
        ),
      ),

    rescheduleSlots: (id, token, query) =>
      request(async () => {
        const params = new URLSearchParams(query);
        const dto = await client.get(`${PT}/bookings/${id}/reschedule-slots?${params}`, {
          schema: AvailabilitySchema,
          headers: guest(token),
        });
        return dto.slots.map((slot) => ({
          startsAt: new Date(slot.startsAt),
          endsAt: new Date(slot.endsAt),
        }));
      }),

    reschedule: (id, token, input) =>
      request(async () =>
        toReservation(
          await client.post(`${PT}/bookings/${id}/reschedule`, {
            schema: PortalBookingDetailSchema,
            headers: guest(token),
            body: { startsAt: input.startsAt.toISOString(), staffId: input.staffId },
          }),
        ),
      ),

    invoice: (id, token) =>
      request(async () =>
        toInvoice(
          await client.get(`${PT}/bookings/${id}/invoice`, {
            schema: PortalInvoiceSchema,
            headers: guest(token),
          }),
        ),
      ),

    invoices: (page) =>
      request(async () => {
        const dto = await client.get(`${PT}/invoices?page=${page}&pageSize=20`, {
          schema: PortalInvoiceListSchema,
        });
        return {
          ...dto,
          items: dto.items.map((item) => ({
            reservationId: item.bookingId,
            number: item.number,
            status: item.status,
            amountCents: item.amountCents,
            issuedAt: new Date(item.issuedAt),
            businessName: item.businessName,
            serviceName: item.serviceName,
          })),
        };
      }),
  };
}

const DemoCheckoutSchema = z.object({
  businessName: z.string(),
  description: z.string(),
  amountCents: z.number(),
  status: z.string(),
  expiresAt: z.string(),
  bookingId: z.string(),
});

/** `/v1/payments/demo/:sessionId` (FSD 5.6): only answers when the API has no Stripe keys. */
export function createHttpDemoCheckoutRepository(client: ApiClient): DemoCheckoutRepository {
  const path = (sessionId: string, tenantId: string) =>
    `/v1/payments/demo/${encodeURIComponent(sessionId)}?tenant=${encodeURIComponent(tenantId)}`;
  return {
    get: (sessionId, tenantId) =>
      request(async () => {
        const dto = await client.get(path(sessionId, tenantId), { schema: DemoCheckoutSchema });
        return {
          businessName: dto.businessName,
          description: dto.description,
          amountCents: dto.amountCents,
          status: dto.status,
          expiresAt: new Date(dto.expiresAt),
          reservationId: dto.bookingId,
        };
      }),
    complete: (sessionId, tenantId, outcome) =>
      request(async () => {
        await client.post(path(sessionId, tenantId), {
          schema: z.undefined(),
          body: { outcome },
        });
      }),
  };
}
