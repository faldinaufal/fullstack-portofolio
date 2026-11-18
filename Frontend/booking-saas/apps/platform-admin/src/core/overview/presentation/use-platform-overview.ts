// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import { useQuery } from '@tanstack/react-query';
import { useDependencies } from '../../shared/presentation/dependencies';
import {
  toPlatformOverviewViewModel,
  type PlatformOverviewViewModel,
} from './platform-overview.view-model';

export type PlatformOverviewState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; overview: PlatformOverviewViewModel };

export function usePlatformOverview(): PlatformOverviewState {
  const { getPlatformOverview, now } = useDependencies();
  const query = useQuery({
    queryKey: ['platform-overview'],
    queryFn: () => getPlatformOverview(),
  });

  if (query.isPending) return { status: 'loading' };
  if (query.isError) return { status: 'error' };
  return { status: 'ready', overview: toPlatformOverviewViewModel(query.data, now()) };
}
