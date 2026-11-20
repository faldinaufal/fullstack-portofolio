// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDependencies } from '../../shared/presentation/dependencies';
import {
  displayStatus,
  type NewTenant,
  type TenantDetail,
  type TenantFilter,
  type TenantQuery,
} from '../domain/tenant';

export { displayStatus, suggestSlug } from '../domain/tenant';
export type { AuditEntry, Tenant, TenantDetail, TenantFilter, TenantQuery } from '../domain/tenant';

export const STATUS: Record<
  TenantFilter,
  { label: string; tone: 'success' | 'warning' | 'danger' }
> = {
  active: { label: 'Active', tone: 'success' },
  onboarding: { label: 'Onboarding', tone: 'warning' },
  suspended: { label: 'Suspended', tone: 'danger' },
};

/** Labels of the platform log's actions. */
const ACTIONS: Record<string, string> = {
  'tenant.created': 'Tenant created (owner invited)',
  'tenant.suspended': 'Tenant suspended',
  'tenant.reactivated': 'Tenant reactivated',
  'support.viewed': 'Support view opened',
};
export const actionLabel = (action: string) => ACTIONS[action] ?? action;

export const statusOf = (tenant: Parameters<typeof displayStatus>[0]) =>
  STATUS[displayStatus(tenant)];

export function useTenants(query: TenantQuery) {
  const { tenants } = useDependencies();
  return useQuery({
    queryKey: ['tenants', query],
    queryFn: () => tenants.list(query),
    placeholderData: keepPreviousData,
  });
}

export function useTenant(id: string) {
  const { tenants } = useDependencies();
  return useQuery({ queryKey: ['tenant', id], queryFn: () => tenants.get(id), retry: false });
}

function useTenantChange<TInput>(run: (input: TInput) => Promise<TenantDetail>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: (tenant) => {
      queryClient.setQueryData(['tenant', tenant.id], tenant);
      void queryClient.invalidateQueries({ queryKey: ['tenants'] });
      void queryClient.invalidateQueries({ queryKey: ['platform-audit'] });
      void queryClient.invalidateQueries({ queryKey: ['overview'] });
    },
  });
}

export function useCreateTenant() {
  const { tenants } = useDependencies();
  return useTenantChange((input: NewTenant) => tenants.create(input));
}

export function useSuspendTenant(id: string) {
  const { tenants } = useDependencies();
  return useTenantChange((reason: string) => tenants.suspend(id, reason));
}

export function useReactivateTenant(id: string) {
  const { tenants } = useDependencies();
  return useTenantChange((_: void) => tenants.reactivate(id));
}

export function usePlatformAudit(page: number) {
  const { tenants } = useDependencies();
  return useQuery({
    queryKey: ['platform-audit', page],
    queryFn: () => tenants.audit(page),
    placeholderData: keepPreviousData,
  });
}
