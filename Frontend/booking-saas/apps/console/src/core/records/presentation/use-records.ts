// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useDependencies } from '../../shared/presentation/dependencies';
import type { CustomerFilters, InvoiceFilters, InvoiceStatus } from '../domain/records';

export type {
  Customer,
  CustomerDetail,
  CustomerFilters,
  Invoice,
  InvoiceDetail,
  InvoiceFilters,
  InvoiceStatus,
} from '../domain/records';

export const INVOICE_STATUS: Record<
  InvoiceStatus,
  { label: string; tone: 'warning' | 'success' | 'neutral' }
> = {
  open: { label: 'Unpaid', tone: 'warning' },
  paid: { label: 'Paid', tone: 'success' },
  void: { label: 'Void', tone: 'neutral' },
};

/** "23 Nov 2026" in the business's time zone; "—" when empty. */
export const shortDate = (instant: Date | null, timeZone: string) =>
  instant
    ? new Intl.DateTimeFormat('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone,
      }).format(instant)
    : '—';

export function useCustomers(filters: CustomerFilters) {
  const { records } = useDependencies();
  return useQuery({
    queryKey: ['customers', filters],
    queryFn: () => records.customers(filters),
    placeholderData: keepPreviousData,
  });
}

export function useCustomer(id: string) {
  const { records } = useDependencies();
  return useQuery({
    queryKey: ['customer', id],
    queryFn: () => records.customer(id),
    retry: false,
  });
}

export function useInvoices(filters: InvoiceFilters) {
  const { records } = useDependencies();
  return useQuery({
    queryKey: ['invoices', filters],
    queryFn: () => records.invoices(filters),
    placeholderData: keepPreviousData,
  });
}

export function useInvoice(id: string) {
  const { records } = useDependencies();
  return useQuery({ queryKey: ['invoice', id], queryFn: () => records.invoice(id), retry: false });
}

/** CSV download links for the current filters (FSD 5.1). */
export function useExportUrls() {
  const { records } = useDependencies();
  return { customers: records.customersExportUrl, invoices: records.invoicesExportUrl };
}
