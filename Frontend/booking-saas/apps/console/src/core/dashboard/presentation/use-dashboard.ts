// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useDependencies } from '../../shared/presentation/dependencies';
import type { DashboardRange } from '../domain/dashboard';

export {
  presetRange,
  upNext,
  type DashboardPreset,
  type DashboardRange,
} from '../domain/dashboard';

/** One query per report, so each chart loads and fails on its own. */
export function useDashboardReports(range: DashboardRange) {
  const { dashboard } = useDependencies();
  const options = { placeholderData: keepPreviousData, staleTime: 60_000 } as const;
  return {
    overview: useQuery({
      queryKey: ['reports', 'overview', range.branchId],
      queryFn: () => dashboard.overview(range.branchId),
      ...options,
    }),
    revenue: useQuery({
      queryKey: ['reports', 'revenue', range],
      queryFn: () => dashboard.revenue(range),
      ...options,
    }),
    services: useQuery({
      queryKey: ['reports', 'services', range],
      queryFn: () => dashboard.services(range),
      ...options,
    }),
    utilization: useQuery({
      queryKey: ['reports', 'utilization', range],
      queryFn: () => dashboard.utilization(range),
      ...options,
    }),
    noShows: useQuery({
      queryKey: ['reports', 'no-shows', range],
      queryFn: () => dashboard.noShows(range),
      ...options,
    }),
  };
}
