// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useDependencies } from '../../shared/presentation/dependencies';
import type { AuditFilters, EmailFilters, EmailStatus } from '../domain/logs';

export type {
  AuditEntry,
  AuditFilters,
  EmailEntry,
  EmailFilters,
  EmailStatus,
} from '../domain/logs';
export { ACTION_GROUPS, actionLabel, diffOf, templateLabel } from '../domain/logs';

export const EMAIL_STATUS: Record<
  EmailStatus,
  { label: string; tone: 'neutral' | 'success' | 'danger' | 'warning' }
> = {
  queued: { label: 'Waiting', tone: 'warning' },
  sent: { label: 'Sent', tone: 'success' },
  failed: { label: 'Failed', tone: 'danger' },
  skipped: { label: 'Not needed', tone: 'neutral' },
};

/** The audit log pages by cursor: "Load more" appends the next page (FSD 5.1). */
export function useAuditLog(filters: AuditFilters) {
  const { logs } = useDependencies();
  return useInfiniteQuery({
    queryKey: ['audit-log', filters],
    queryFn: ({ pageParam }) => logs.audit(filters, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
  });
}

export function useAuditExportUrl(filters: AuditFilters) {
  const { logs } = useDependencies();
  return logs.auditExportUrl(filters);
}

export function useEmailLog(filters: EmailFilters) {
  const { logs } = useDependencies();
  return useQuery({
    queryKey: ['email-log', filters],
    queryFn: () => logs.emails(filters),
    placeholderData: keepPreviousData,
  });
}
