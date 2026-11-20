// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDependencies } from '../../shared/presentation/dependencies';
import type { SupportDuration } from '../domain/support';

export type { SupportDuration, SupportGrant, SupportGrants } from '../domain/support';
export { durationLabel, SUPPORT_DURATIONS, timeLeft } from '../domain/support';

const KEY = ['support', 'grants'] as const;

export function useSupportGrants() {
  const { support } = useDependencies();
  // Refetched every minute so an expiry shows without a reload.
  return useQuery({ queryKey: KEY, queryFn: () => support.grants(), refetchInterval: 60_000 });
}

export function useGrantSupport() {
  const { support } = useDependencies();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (hours: SupportDuration) => support.grant(hours),
    onSuccess: (grants) => queryClient.setQueryData(KEY, grants),
  });
}

export function useRevokeSupport() {
  const { support } = useDependencies();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => support.revoke(id),
    onSuccess: (grants) => queryClient.setQueryData(KEY, grants),
  });
}
