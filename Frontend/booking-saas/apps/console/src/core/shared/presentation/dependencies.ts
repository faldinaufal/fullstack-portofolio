// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import { createContext, useContext } from 'react';
import type { AuthUseCases } from '../../auth/domain/auth-use-cases';
import type { BookingRepository } from '../../bookings/domain/booking';
import type { BranchRepository } from '../../branches/domain/branch';
import type { CatalogueRepository } from '../../catalogue/domain/catalogue';
import type { DashboardRepository } from '../../dashboard/domain/dashboard';
import type { GetApiStatus } from '../../health/domain/get-api-status';
import type { RecordsRepository } from '../../records/domain/records';
import type { SupportRepository } from '../../support/domain/support';
import type { TeamRepository } from '../../team/domain/team';

/**
 * Use cases available to the presentation layer. Presentation depends on these
 * domain contracts only; the composition root decides which implementations to inject
 * (HTTP or demo repositories in the app, fakes in tests).
 */
export interface Dependencies {
  auth: AuthUseCases;
  bookings: BookingRepository;
  branches: BranchRepository;
  catalogue: CatalogueRepository;
  team: TeamRepository;
  records: RecordsRepository;
  support: SupportRepository;
  getApiStatus: GetApiStatus;
  dashboard: DashboardRepository;
}

export const DependenciesContext = createContext<Dependencies | null>(null);

export function useDependencies(): Dependencies {
  const dependencies = useContext(DependenciesContext);
  if (!dependencies) {
    throw new Error('useDependencies must be used inside the app providers.');
  }
  return dependencies;
}
