// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import { useQuery } from '@tanstack/react-query';
import { useDependencies } from '../../shared/presentation/dependencies';
import { toApiStatusViewModel, type ApiStatusViewModel } from './api-status.view-model';

/** Presentation hook: runs the use case, caches it and exposes a view-model. No JSX. */
export function useApiStatus(): ApiStatusViewModel {
  const { getApiStatus } = useDependencies();
  const { data } = useQuery({
    queryKey: ['health', 'api-status'],
    queryFn: () => getApiStatus(),
    refetchInterval: 30_000,
  });
  return toApiStatusViewModel(data);
}
