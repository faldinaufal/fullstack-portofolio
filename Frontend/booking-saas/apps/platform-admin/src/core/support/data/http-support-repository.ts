// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { ApiClient } from '@tempora/api-client';
import {
  ConsoleBookingDetailSchema,
  ConsoleBookingListSchema,
  ConsoleCustomerDetailSchema,
  ConsoleInvoiceDetailSchema,
  CustomerListSchema,
  InvoiceListSchema,
  type ConsoleBooking,
  type ConsoleCustomer,
  type ConsoleInvoice,
} from '@tempora/contracts';
import { request } from '../../shared/data/to-request-error';
import type {
  SupportBooking,
  SupportCustomer,
  SupportInvoice,
  SupportQuery,
  SupportRepository,
} from '../domain/support';

const date = (value: string | null) => (value ? new Date(value) : null);

export const toBooking = (dto: ConsoleBooking): SupportBooking => ({
  id: dto.id,
  status: dto.status,
  startsAt: new Date(dto.startsAt),
  endsAt: new Date(dto.endsAt),
  serviceName: dto.serviceName,
  priceCents: dto.priceCents,
  branch: dto.branch.name,
  therapist: dto.therapist.name,
  customer: dto.customer,
  invoice: { number: dto.invoice.number, status: dto.invoice.status },
});

export const toCustomer = (dto: ConsoleCustomer): SupportCustomer => ({
  ...dto,
  lastVisitAt: date(dto.lastVisitAt),
  nextBookingAt: date(dto.nextBookingAt),
});

export const toInvoice = (dto: ConsoleInvoice): SupportInvoice => ({
  id: dto.id,
  number: dto.number,
  status: dto.status,
  amountCents: dto.amountCents,
  issuedAt: new Date(dto.issuedAt),
  paidAt: date(dto.paidAt),
  customer: dto.customer.name,
  serviceName: dto.serviceName,
  branch: dto.branch.name,
  bookingId: dto.bookingId,
});

function params(query: SupportQuery) {
  const result = new URLSearchParams({ page: String(query.page), pageSize: '25' });
  if (query.q) result.set('q', query.q);
  if (query.status) result.set('status', query.status);
  return result;
}

/** `/v1/admin/tenants/:id/support/*` (FSD 5.5). Every call needs a fresh step-up. */
export function createHttpSupportRepository(client: ApiClient): SupportRepository {
  const base = (tenantId: string) => `/v1/admin/tenants/${tenantId}/support`;
  return {
    bookings: (tenantId, query) =>
      request(async () => {
        const dto = await client.get(`${base(tenantId)}/bookings?${params(query)}`, {
          schema: ConsoleBookingListSchema,
        });
        return { ...dto, items: dto.items.map(toBooking) };
      }),
    booking: (tenantId, id) =>
      request(async () => {
        const dto = await client.get(`${base(tenantId)}/bookings/${id}`, {
          schema: ConsoleBookingDetailSchema,
        });
        return {
          ...toBooking(dto),
          customerId: dto.customer.id,
          customer: { name: dto.customer.name, email: dto.customer.email },
          customerPhone: dto.customer.phone,
          notes: dto.notes,
          durationMinutes: dto.durationMinutes,
          bufferMinutes: dto.bufferMinutes,
          cancelReason: dto.cancelReason,
          timeZone: dto.timeZone,
        };
      }),
    customers: (tenantId, query) =>
      request(async () => {
        const dto = await client.get(`${base(tenantId)}/customers?${params(query)}`, {
          schema: CustomerListSchema,
        });
        return { ...dto, items: dto.items.map(toCustomer) };
      }),
    customer: (tenantId, id) =>
      request(async () => {
        const dto = await client.get(`${base(tenantId)}/customers/${id}`, {
          schema: ConsoleCustomerDetailSchema,
        });
        return {
          ...toCustomer(dto),
          bookings: dto.bookings.map(toBooking),
          timeZone: dto.timeZone,
        };
      }),
    invoices: (tenantId, query) =>
      request(async () => {
        const dto = await client.get(`${base(tenantId)}/invoices?${params(query)}`, {
          schema: InvoiceListSchema,
        });
        return { ...dto, items: dto.items.map(toInvoice) };
      }),
    invoice: (tenantId, id) =>
      request(async () => {
        const dto = await client.get(`${base(tenantId)}/invoices/${id}`, {
          schema: ConsoleInvoiceDetailSchema,
        });
        return {
          ...toInvoice(dto),
          customerId: dto.customer.id,
          customerEmail: dto.customer.email,
          voidReason: dto.voidReason,
          payments: dto.payments.map((p) => ({ ...p, createdAt: new Date(p.createdAt) })),
          timeZone: dto.timeZone,
        };
      }),
  };
}
