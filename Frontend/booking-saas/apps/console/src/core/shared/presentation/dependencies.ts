// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import { createContext, useContext } from 'react';
import type { AuthUseCases } from '../../auth/domain/auth-use-cases';
import type { GetDashboard } from '../../dashboard/domain/get-dashboard';
import type { GetApiStatus } from '../../health/domain/get-api-status';

/**
 * Use cases available to the presentation layer. Presentation depends on these
 * domain contracts only; the composition root decides which implementations to inject
 * (HTTP or demo repositories in the app, fakes in tests).
 */
export interface Dependencies {
  auth: AuthUseCases;
  getApiStatus: GetApiStatus;
  getDashboard: GetDashboard;
}

export const DependenciesContext = createContext<Dependencies | null>(null);

export function useDependencies(): Dependencies {
  const dependencies = useContext(DependenciesContext);
  if (!dependencies) {
    throw new Error('useDependencies must be used inside the app providers.');
  }
  return dependencies;
}
