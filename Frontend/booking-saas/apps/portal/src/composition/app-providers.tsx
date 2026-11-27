// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createApiClient } from '@tempora/api-client';
import { ThemeProvider } from '@tempora/ui';
import { useState, type ReactNode } from 'react';
import { createHttpAccountRepository } from '@/core/account/data/http-account-repository';
import { createHttpBookingRepository } from '@/core/booking/data/http-booking-repository';
import { createHttpDemoInboxRepository } from '@/core/demo-inbox/data/http-demo-inbox-repository';
import { createHttpBusinessRepository } from '@/core/directory/data/http-business-repository';
import { createListFeaturedBusinesses } from '@/core/directory/domain/list-featured-businesses';
import { createHttpApiStatusRepository } from '@/core/health/data/http-api-status-repository';
import { createGetApiStatus } from '@/core/health/domain/get-api-status';
import {
  createHttpDemoCheckoutRepository,
  createHttpReservationRepository,
} from '@/core/reservation/data/http-reservation-repository';
import { createSessionAccessStore } from '@/core/reservation/data/session-access-store';
import { DependenciesContext, type Dependencies } from '@/core/shared/presentation/dependencies';

/**
 * Composition root: the only place that knows concrete implementations.
 * It builds the API client and repositories (data), wraps them in use cases (domain)
 * and hands them to the presentation layer through context.
 */
function createDependencies(): Dependencies {
  const apiClient = createApiClient({
    baseUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000',
    csrfPath: '/v1/portal/auth/csrf',
  });
  return {
    getApiStatus: createGetApiStatus(createHttpApiStatusRepository(apiClient)),
    listFeaturedBusinesses: createListFeaturedBusinesses(createHttpBusinessRepository(apiClient)),
    booking: createHttpBookingRepository(apiClient),
    account: createHttpAccountRepository(apiClient),
    reservations: createHttpReservationRepository(apiClient),
    bookingAccess: createSessionAccessStore(),
    demoCheckout: createHttpDemoCheckoutRepository(apiClient),
    demoInbox: createHttpDemoInboxRepository(apiClient),
  };
}

export function AppProviders({ children }: { children: ReactNode }) {
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
