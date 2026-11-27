// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import { createContext, useContext } from 'react';
import type { AccountRepository } from '../../account/domain/account';
import type { BookingRepository } from '../../booking/domain/booking';
import type { DemoInboxRepository } from '../../demo-inbox/domain/demo-inbox';
import type { ListFeaturedBusinesses } from '../../directory/domain/list-featured-businesses';
import type { GetApiStatus } from '../../health/domain/get-api-status';
import type { DemoCheckoutRepository } from '../../reservation/domain/demo-checkout';
import type {
  BookingAccessStore,
  ReservationRepository,
} from '../../reservation/domain/reservation';

/**
 * Use cases available to the presentation layer. Presentation depends on these
 * domain contracts only; the composition root decides which implementations to inject
 * (HTTP or demo repositories in the app, fakes in tests).
 */
export interface Dependencies {
  getApiStatus: GetApiStatus;
  listFeaturedBusinesses: ListFeaturedBusinesses;
  booking: BookingRepository;
  account: AccountRepository;
  reservations: ReservationRepository;
  bookingAccess: BookingAccessStore;
  demoCheckout: DemoCheckoutRepository;
  demoInbox: DemoInboxRepository;
}

export const DependenciesContext = createContext<Dependencies | null>(null);

export function useDependencies(): Dependencies {
  const dependencies = useContext(DependenciesContext);
  if (!dependencies) {
    throw new Error('useDependencies must be used inside the app providers.');
  }
  return dependencies;
}
