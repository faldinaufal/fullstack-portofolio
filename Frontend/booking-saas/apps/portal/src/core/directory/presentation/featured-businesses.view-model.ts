// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { Business } from '../domain/business';

export interface BusinessCardViewModel {
  id: string;
  href: string;
  name: string;
  initial: string;
  summary: string;
  branches: string[];
}

export function toBusinessCard(business: Business): BusinessCardViewModel {
  const count = business.branchNames.length;
  return {
    id: business.id,
    href: `/${business.slug}`,
    name: business.name,
    initial: business.name.charAt(0).toUpperCase(),
    summary: `${business.offering} · ${count} ${count === 1 ? 'branch' : 'branches'}`,
    branches: business.branchNames,
  };
}
