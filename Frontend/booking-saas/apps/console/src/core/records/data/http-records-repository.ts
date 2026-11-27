// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { ApiClient } from '@tempora/api-client';
import {
  ConsoleCustomerDetailSchema,
  ConsoleInvoiceDetailSchema,
  CustomerListSchema,
  CustomerSummarySchema,
  InvoiceListSchema,
  type ConsoleCustomer,
  type ConsoleInvoice,
} from '@tempora/contracts';
import { toBookingRow } from '../../bookings/data/http-booking-repository';
import { request } from '../../shared/data/to-request-error';
import type {
  Customer,
  CustomerFilters,
  Invoice,
  InvoiceFilters,
  RecordsRepository,
} from '../domain/records';

const C = '/v1/console';
const date = (value: string | null) => (value ? new Date(value) : null);

export const toCustomer = (dto: ConsoleCustomer): Customer => ({
  ...dto,
  lastVisitAt: date(dto.lastVisitAt),
  nextBookingAt: date(dto.nextBookingAt),
});

export const toInvoice = (dto: ConsoleInvoice): Invoice => ({
  ...dto,
  issuedAt: new Date(dto.issuedAt),
  paidAt: date(dto.paidAt),
  voidedAt: date(dto.voidedAt),
});

/** Only the filters that are set; `page` and `format` are added by the caller. */
function params(filters: object): URLSearchParams {
  const result = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (key !== 'page' && value !== undefined && value !== '') result.set(key, String(value));
  }
  return result;
}

const paged = (filters: { page: number }) => {
  const result = params(filters);
  result.set('page', String(filters.page));
  result.set('pageSize', '25');
  return result;
};

const csv = (filters: object) => {
  const result = params(filters);
  result.set('format', 'csv');
  return result;
};

/** `/v1/console/customers*` and `/v1/console/invoices*` (FSD 5.4). */
export function createHttpRecordsRepository(client: ApiClient, apiUrl: string): RecordsRepository {
  return {
    customers: (filters: CustomerFilters) =>
      request(async () => {
        const dto = await client.get(`${C}/customers?${paged(filters)}`, {
          schema: CustomerListSchema,
        });
        return { ...dto, items: dto.items.map(toCustomer) };
      }),
    customerSummary: () =>
      request(() => client.get(`${C}/customers/summary`, { schema: CustomerSummarySchema })),

    customer: (id) =>
      request(async () => {
        const dto = await client.get(`${C}/customers/${id}`, {
          schema: ConsoleCustomerDetailSchema,
        });
        return {
          ...toCustomer(dto),
          bookings: dto.bookings.map(toBookingRow),
          timeZone: dto.timeZone,
        };
      }),

    customersExportUrl: (filters) => `${apiUrl}${C}/customers?${csv(filters)}`,

    invoices: (filters: InvoiceFilters) =>
      request(async () => {
        const dto = await client.get(`${C}/invoices?${paged(filters)}`, {
          schema: InvoiceListSchema,
        });
        return { ...dto, items: dto.items.map(toInvoice) };
      }),

    invoice: (id) =>
      request(async () => {
        const dto = await client.get(`${C}/invoices/${id}`, { schema: ConsoleInvoiceDetailSchema });
        return {
          ...toInvoice(dto),
          voidReason: dto.voidReason,
          customer: dto.customer,
          booking: {
            ...dto.booking,
            startsAt: new Date(dto.booking.startsAt),
            endsAt: new Date(dto.booking.endsAt),
          },
          payments: dto.payments.map((p) => ({ ...p, createdAt: new Date(p.createdAt) })),
          timeZone: dto.timeZone,
        };
      }),

    invoicesExportUrl: (filters) => `${apiUrl}${C}/invoices?${csv(filters)}`,
  };
}
