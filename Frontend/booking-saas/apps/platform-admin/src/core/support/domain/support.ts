// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

/**
 * Support views (FSD 1.4, 2.3 `/tenants/[id]/support/...`): a tenant's bookings, customers and
 * invoices while its owner grants access. Read only; every view is in the tenant's audit log.
 */

export type SupportView = 'bookings' | 'customers' | 'invoices';
export const SUPPORT_VIEWS: readonly SupportView[] = ['bookings', 'customers', 'invoices'];

export interface SupportPage<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  timeZone: string;
}

export interface SupportBooking {
  id: string;
  status: string;
  startsAt: Date;
  endsAt: Date;
  serviceName: string;
  priceCents: number;
  branch: string;
  therapist: string;
  customer: { name: string; email: string | null };
  invoice: { number: string; status: string };
}

export interface SupportBookingDetail extends SupportBooking {
  customerId: string;
  customerPhone: string | null;
  notes: string | null;
  durationMinutes: number;
  bufferMinutes: number;
  cancelReason: string | null;
  timeZone: string;
}

export interface SupportCustomer {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  hasAccount: boolean;
  bookingCount: number;
  lastVisitAt: Date | null;
  nextBookingAt: Date | null;
}

export interface SupportCustomerDetail extends SupportCustomer {
  bookings: SupportBooking[];
  timeZone: string;
}

export interface SupportInvoice {
  id: string;
  number: string;
  status: 'open' | 'paid' | 'void';
  amountCents: number;
  issuedAt: Date;
  paidAt: Date | null;
  customer: string;
  serviceName: string;
  branch: string;
  bookingId: string;
}

export interface SupportPayment {
  id: string;
  provider: string;
  status: string;
  amountCents: number;
  createdAt: Date;
}

export interface SupportInvoiceDetail extends SupportInvoice {
  customerId: string;
  customerEmail: string | null;
  voidReason: string | null;
  payments: SupportPayment[];
  timeZone: string;
}

export interface SupportQuery {
  q?: string | undefined;
  status?: string | undefined;
  page: number;
}

export interface SupportRepository {
  bookings(tenantId: string, query: SupportQuery): Promise<SupportPage<SupportBooking>>;
  booking(tenantId: string, id: string): Promise<SupportBookingDetail>;
  customers(tenantId: string, query: SupportQuery): Promise<SupportPage<SupportCustomer>>;
  customer(tenantId: string, id: string): Promise<SupportCustomerDetail>;
  invoices(tenantId: string, query: SupportQuery): Promise<SupportPage<SupportInvoice>>;
  invoice(tenantId: string, id: string): Promise<SupportInvoiceDetail>;
}

/** "$42.17" */
export const dollars = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);

/** "Open until 23 Nov, 16:00 · 45 min left"; null once the grant ended. */
export function grantBanner(expiresAt: Date, now: Date, timeZone: string): string | null {
  const minutes = Math.ceil((expiresAt.getTime() - now.getTime()) / 60_000);
  if (minutes <= 0) return null;
  const until = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  }).format(expiresAt);
  const hours = Math.floor(minutes / 60);
  const left = hours > 0 ? `${hours} h ${minutes % 60} min` : `${minutes} min`;
  return `Open until ${until} · ${left} left`;
}
