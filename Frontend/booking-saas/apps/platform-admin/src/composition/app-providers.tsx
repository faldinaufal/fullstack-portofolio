// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createApiClient } from '@tempora/api-client';
import { ThemeProvider } from '@tempora/ui';
import { useState, type ReactNode } from 'react';
import { createHttpAdminAuthRepository } from '@/core/auth/data/http-admin-auth-repository';
import { createHttpApiStatusRepository } from '@/core/health/data/http-api-status-repository';
import { createGetApiStatus } from '@/core/health/domain/get-api-status';
import { createHttpOverviewRepository } from '@/core/overview/data/http-overview-repository';
import { DependenciesContext, type Dependencies } from '@/core/shared/presentation/dependencies';
import { createHttpSupportRepository } from '@/core/support/data/http-support-repository';
import { createHttpTenantRepository } from '@/core/tenants/data/http-tenant-repository';

/**
 * Composition root: the only place that knows concrete implementations.
 * It builds the API client and repositories (data) and hands them to the presentation layer.
 */
function createDependencies(): Dependencies {
  const apiClient = createApiClient({
    baseUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000',
    csrfPath: '/v1/admin/auth/csrf',
  });
  return {
    getApiStatus: createGetApiStatus(createHttpApiStatusRepository(apiClient)),
    auth: createHttpAdminAuthRepository(apiClient),
    overview: createHttpOverviewRepository(apiClient),
    tenants: createHttpTenantRepository(apiClient),
    support: createHttpSupportRepository(apiClient),
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
