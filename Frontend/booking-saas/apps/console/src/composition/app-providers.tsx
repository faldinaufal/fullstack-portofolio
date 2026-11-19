// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createApiClient } from '@tempora/api-client';
import { ThemeProvider } from '@tempora/ui';
import { useState, type ReactNode } from 'react';
import { createHttpAuthRepository } from '@/core/auth/data/http-auth-repository';
import { createSessionStorageChallengeStore } from '@/core/auth/data/session-storage-challenge-store';
import { createAuthUseCases } from '@/core/auth/domain/auth-use-cases';
import { createHttpBookingRepository } from '@/core/bookings/data/http-booking-repository';
import { createHttpBranchRepository } from '@/core/branches/data/http-branch-repository';
import { createHttpCatalogueRepository } from '@/core/catalogue/data/http-catalogue-repository';
import {
  createDemoDashboardRepository,
  DEMO_NOW,
} from '@/core/dashboard/data/demo-dashboard-repository';
import { createGetDashboard } from '@/core/dashboard/domain/get-dashboard';
import { createHttpApiStatusRepository } from '@/core/health/data/http-api-status-repository';
import { createGetApiStatus } from '@/core/health/domain/get-api-status';
import { DependenciesContext, type Dependencies } from '@/core/shared/presentation/dependencies';
import { createHttpTeamRepository } from '@/core/team/data/http-team-repository';

/**
 * Composition root: the only place that knows concrete implementations.
 * It builds the API client and repositories (data), wraps them in use cases (domain)
 * and hands them to the presentation layer through context.
 */
function createDependencies(): Dependencies {
  const apiClient = createApiClient({
    baseUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000',
    csrfPath: '/v1/console/auth/csrf',
  });
  return {
    auth: createAuthUseCases(
      createHttpAuthRepository(apiClient),
      createSessionStorageChallengeStore(),
    ),
    // Simple CRUD features use their repository directly; a use-case layer is added when a
    // feature has rules of its own beyond the API's.
    bookings: createHttpBookingRepository(apiClient),
    branches: createHttpBranchRepository(apiClient),
    catalogue: createHttpCatalogueRepository(apiClient),
    team: createHttpTeamRepository(apiClient),
    getApiStatus: createGetApiStatus(createHttpApiStatusRepository(apiClient)),
    // Demo data: a fixed "now" keeps "up next" meaningful whenever the demo is opened.
    getDashboard: createGetDashboard(createDemoDashboardRepository(), () => DEMO_NOW),
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
