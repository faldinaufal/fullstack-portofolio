// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import { createContext, useContext } from 'react';
import type { GetApiStatus } from '../../health/domain/get-api-status';
import type { GetPlatformOverview } from '../../overview/domain/get-platform-overview';

/**
 * Use cases available to the presentation layer. Presentation depends on these
 * domain contracts only; the composition root decides which implementations to inject
 * (HTTP or demo repositories in the app, fakes in tests).
 */
export interface Dependencies {
  getApiStatus: GetApiStatus;
  getPlatformOverview: GetPlatformOverview;
  /** Clock, injectable so time-based labels are testable and stable in the demo. */
  now: () => Date;
}

export const DependenciesContext = createContext<Dependencies | null>(null);

export function useDependencies(): Dependencies {
  const dependencies = useContext(DependenciesContext);
  if (!dependencies) {
    throw new Error('useDependencies must be used inside the app providers.');
  }
  return dependencies;
}
