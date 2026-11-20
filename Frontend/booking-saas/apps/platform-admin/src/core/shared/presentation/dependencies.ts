// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import { createContext, useContext } from 'react';
import type { AdminAuthRepository } from '../../auth/domain/admin-auth';
import type { GetApiStatus } from '../../health/domain/get-api-status';
import type { OverviewRepository } from '../../overview/domain/overview';
import type { SupportRepository } from '../../support/domain/support';
import type { TenantRepository } from '../../tenants/domain/tenant';

/**
 * Use cases available to the presentation layer. Presentation depends on these domain
 * contracts only; the composition root decides which implementations to inject.
 */
export interface Dependencies {
  getApiStatus: GetApiStatus;
  auth: AdminAuthRepository;
  overview: OverviewRepository;
  tenants: TenantRepository;
  support: SupportRepository;
}

export const DependenciesContext = createContext<Dependencies | null>(null);

export function useDependencies(): Dependencies {
  const dependencies = useContext(DependenciesContext);
  if (!dependencies) {
    throw new Error('useDependencies must be used inside the app providers.');
  }
  return dependencies;
}
