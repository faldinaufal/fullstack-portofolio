// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import { useQuery } from '@tanstack/react-query';
import { useDependencies } from '../../shared/presentation/dependencies';
import { toBusinessCard, type BusinessCardViewModel } from './featured-businesses.view-model';

export interface FeaturedBusinessesState {
  status: 'loading' | 'error' | 'ready';
  businesses: BusinessCardViewModel[];
}

export function useFeaturedBusinesses(): FeaturedBusinessesState {
  const { listFeaturedBusinesses } = useDependencies();
  const query = useQuery({
    queryKey: ['directory', 'featured'],
    queryFn: () => listFeaturedBusinesses(),
  });

  if (query.isPending) return { status: 'loading', businesses: [] };
  if (query.isError) return { status: 'error', businesses: [] };
  return { status: 'ready', businesses: query.data.map(toBusinessCard) };
}
