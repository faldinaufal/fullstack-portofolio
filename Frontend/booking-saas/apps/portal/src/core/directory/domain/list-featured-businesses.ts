// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { Business, BusinessRepository } from './business';

/**
 * Use case: businesses shown on the home page.
 * Rule: only businesses with at least one branch can take bookings, so others are hidden
 * (FSD 3.4: a tenant appears in the directory once it is set up).
 */
export function createListFeaturedBusinesses(repository: BusinessRepository) {
  return async function listFeaturedBusinesses(): Promise<Business[]> {
    const businesses = await repository.listFeatured();
    return businesses.filter((business) => business.branchNames.length > 0);
  };
}

export type ListFeaturedBusinesses = ReturnType<typeof createListFeaturedBusinesses>;
