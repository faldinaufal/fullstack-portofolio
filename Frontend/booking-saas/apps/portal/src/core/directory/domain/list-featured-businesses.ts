// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { Business, BusinessRepository } from './business';

/**
 * Use case: businesses shown in the directory.
 * Rule: only businesses with at least one branch can take bookings, so others are hidden
 * (FSD 3.4). The API applies the full rule; this keeps the Portal safe with any data source.
 */
export function createListFeaturedBusinesses(repository: BusinessRepository) {
  return async function listFeaturedBusinesses(query?: string): Promise<Business[]> {
    const businesses = await repository.search(query?.trim() || undefined);
    return businesses.filter((business) => business.branchNames.length > 0);
  };
}

export type ListFeaturedBusinesses = ReturnType<typeof createListFeaturedBusinesses>;
