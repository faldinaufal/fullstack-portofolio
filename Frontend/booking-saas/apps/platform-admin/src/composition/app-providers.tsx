// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createApiClient } from '@tempora/api-client';
import { ThemeProvider } from '@tempora/ui';
import { useState, type ReactNode } from 'react';
import { createHttpApiStatusRepository } from '@/core/health/data/http-api-status-repository';
import { createGetApiStatus } from '@/core/health/domain/get-api-status';
import {
  createDemoPlatformOverviewRepository,
  DEMO_NOW,
} from '@/core/overview/data/demo-platform-overview-repository';
import { createGetPlatformOverview } from '@/core/overview/domain/get-platform-overview';
import { DependenciesContext, type Dependencies } from '@/core/shared/presentation/dependencies';

/**
 * Composition root: the only place that knows concrete implementations.
 * It builds the API client and repositories (data), wraps them in use cases (domain)
 * and hands them to the presentation layer through context.
 */
function createDependencies(): Dependencies {
  const apiClient = createApiClient({
    baseUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000',
  });
  return {
    getApiStatus: createGetApiStatus(createHttpApiStatusRepository(apiClient)),
    getPlatformOverview: createGetPlatformOverview(createDemoPlatformOverviewRepository()),
    // Demo data: a fixed "now" keeps time-based labels meaningful in the demo.
    now: () => DEMO_NOW,
  };
}

export function AppProviders({ children }: Readonly<{ children: ReactNode }>) {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 10_000, retry: 1 } } }),
  );
  const [dependencies] = useState(createDependencies);

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <DependenciesContext value={dependencies}>{children}</DependenciesContext>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
