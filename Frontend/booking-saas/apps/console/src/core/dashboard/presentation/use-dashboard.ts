'use client';

import { useQuery } from '@tanstack/react-query';
import { useDependencies } from '../../shared/presentation/dependencies';
import { toDashboardViewModel, type DashboardViewModel } from './dashboard.view-model';

export type DashboardState =
  { status: 'loading' } | { status: 'error' } | { status: 'ready'; dashboard: DashboardViewModel };

export function useDashboard(): DashboardState {
  const { getDashboard } = useDependencies();
  const query = useQuery({ queryKey: ['dashboard'], queryFn: () => getDashboard() });

  if (query.isPending) return { status: 'loading' };
  if (query.isError) return { status: 'error' };
  return { status: 'ready', dashboard: toDashboardViewModel(query.data) };
}
