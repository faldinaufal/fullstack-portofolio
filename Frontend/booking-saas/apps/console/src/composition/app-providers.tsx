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
import { createHttpLogRepository } from '@/core/logs/data/http-log-repository';
import { createHttpRecordsRepository } from '@/core/records/data/http-records-repository';
import { createHttpSupportRepository } from '@/core/support/data/http-support-repository';
import { createHttpCatalogueRepository } from '@/core/catalogue/data/http-catalogue-repository';
import { createHttpDashboardRepository } from '@/core/dashboard/data/http-dashboard-repository';
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
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
  const apiClient = createApiClient({ baseUrl: apiUrl, csrfPath: '/v1/console/auth/csrf' });
  return {
    auth: createAuthUseCases(
      createHttpAuthRepository(apiClient),
      createSessionStorageChallengeStore(),
    ),
    // Simple CRUD features use their repository directly; a use-case layer is added when a
    // feature has rules of its own beyond the API's.
    // CSV downloads are plain links to the API, so these repositories also get its URL.
    bookings: createHttpBookingRepository(apiClient, apiUrl),
    records: createHttpRecordsRepository(apiClient, apiUrl),
    support: createHttpSupportRepository(apiClient),
    logs: createHttpLogRepository(apiClient, apiUrl),
    branches: createHttpBranchRepository(apiClient),
    catalogue: createHttpCatalogueRepository(apiClient),
    team: createHttpTeamRepository(apiClient),
    getApiStatus: createGetApiStatus(createHttpApiStatusRepository(apiClient)),
    dashboard: createHttpDashboardRepository(apiClient),
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
