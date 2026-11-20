// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { RequestError } from '../../shared/domain/request-error';
import { useDependencies } from '../../shared/presentation/dependencies';
import type { SupportQuery } from '../domain/support';

export type {
  SupportBooking,
  SupportBookingDetail,
  SupportCustomer,
  SupportCustomerDetail,
  SupportInvoice,
  SupportInvoiceDetail,
  SupportQuery,
  SupportView,
} from '../domain/support';
export { dollars, grantBanner, SUPPORT_VIEWS } from '../domain/support';

/**
 * Support data is not kept after leaving a page (each view is a logged access) and never
 * retried: a missing step-up or a closed grant needs the admin, not another try.
 */
const options = { retry: false, gcTime: 0, staleTime: 0 } as const;

export function useSupportBookings(tenantId: string, query: SupportQuery) {
  const { support } = useDependencies();
  return useQuery({
    queryKey: ['support', tenantId, 'bookings', query],
    queryFn: () => support.bookings(tenantId, query),
    placeholderData: keepPreviousData,
    ...options,
  });
}

export function useSupportBooking(tenantId: string, id: string) {
  const { support } = useDependencies();
  return useQuery({
    queryKey: ['support', tenantId, 'booking', id],
    queryFn: () => support.booking(tenantId, id),
    ...options,
  });
}

export function useSupportCustomers(tenantId: string, query: SupportQuery) {
  const { support } = useDependencies();
  return useQuery({
    queryKey: ['support', tenantId, 'customers', query],
    queryFn: () => support.customers(tenantId, query),
    placeholderData: keepPreviousData,
    ...options,
  });
}

export function useSupportCustomer(tenantId: string, id: string) {
  const { support } = useDependencies();
  return useQuery({
    queryKey: ['support', tenantId, 'customer', id],
    queryFn: () => support.customer(tenantId, id),
    ...options,
  });
}

export function useSupportInvoices(tenantId: string, query: SupportQuery) {
  const { support } = useDependencies();
  return useQuery({
    queryKey: ['support', tenantId, 'invoices', query],
    queryFn: () => support.invoices(tenantId, query),
    placeholderData: keepPreviousData,
    ...options,
  });
}

export function useSupportInvoice(tenantId: string, id: string) {
  const { support } = useDependencies();
  return useQuery({
    queryKey: ['support', tenantId, 'invoice', id],
    queryFn: () => support.invoice(tenantId, id),
    ...options,
  });
}

/** Why a support view failed, so the screen can offer the right next step. */
export function supportBlock(error: unknown): 'step-up' | 'closed' | null {
  if (!(error instanceof RequestError)) return null;
  if (error.code === 'STEP_UP_REQUIRED') return 'step-up';
  if (error.code === 'SUPPORT_ACCESS_REQUIRED') return 'closed';
  return null;
}
