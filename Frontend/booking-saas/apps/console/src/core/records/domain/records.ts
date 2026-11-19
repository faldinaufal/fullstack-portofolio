// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { BookingRow } from '../../bookings/domain/booking';

/** Customers and invoices as the Console shows them (FSD 2.2 Customers, Invoices). */

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  hasAccount: boolean;
  bookingCount: number;
  lastVisitAt: Date | null;
  nextBookingAt: Date | null;
}

export interface CustomerFilters {
  q?: string | undefined;
  sort: 'name' | '-lastVisit';
  page: number;
}

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  timeZone: string;
}

export interface CustomerDetail extends Customer {
  bookings: BookingRow[];
  timeZone: string;
}

export type InvoiceStatus = 'open' | 'paid' | 'void';

export interface Invoice {
  id: string;
  number: string;
  status: InvoiceStatus;
  amountCents: number;
  currency: string;
  issuedAt: Date;
  paidAt: Date | null;
  voidedAt: Date | null;
  bookingId: string;
  serviceName: string;
  branch: { id: string; name: string };
  customer: { id: string; name: string };
}

export interface InvoiceFilters {
  status?: InvoiceStatus | undefined;
  branchId?: string | undefined;
  from?: string | undefined;
  to?: string | undefined;
  q?: string | undefined;
  page: number;
}

export interface InvoiceDetail extends Omit<Invoice, 'customer'> {
  voidReason: string | null;
  customer: { id: string; name: string; email: string; phone: string | null };
  booking: { id: string; status: string; startsAt: Date; endsAt: Date; therapist: string };
  payments: {
    id: string;
    provider: string;
    status: string;
    amountCents: number;
    createdAt: Date;
  }[];
  timeZone: string;
}

/** Implemented by the data layer; failures are `RequestError`s. */
export interface RecordsRepository {
  customers(filters: CustomerFilters): Promise<Page<Customer>>;
  customer(id: string): Promise<CustomerDetail>;
  /** CSV download links with the same filters (FSD 5.1). */
  customersExportUrl(filters: CustomerFilters): string;
  invoices(filters: InvoiceFilters): Promise<Page<Invoice>>;
  invoice(id: string): Promise<InvoiceDetail>;
  invoicesExportUrl(filters: InvoiceFilters): string;
}
