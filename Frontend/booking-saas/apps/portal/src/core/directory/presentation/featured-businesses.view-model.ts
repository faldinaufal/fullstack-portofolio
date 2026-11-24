// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { Business } from '../domain/business';

/** How many service names a directory card lists before "+N more". */
const SERVICES_SHOWN = 3;

export interface BusinessCardViewModel {
  id: string;
  /** Business page (`/[tenant]`). */
  href: string;
  /** Booking step 1 (`/[tenant]/book`). */
  bookHref: string;
  name: string;
  /** Up to two letters, shown in place of a logo. */
  initials: string;
  logoUrl: string | null;
  summary: string;
  /** "3 branches: Downtown, Riverside, Northgate" */
  branchLabel: string;
  /** "View 3 branches" */
  branchLink: string;
  services: string[];
  moreServices: number;
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 'es'}`;

export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return words
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('');
}

export function toBusinessCard(business: Business): BusinessCardViewModel {
  const branches = business.branchNames;
  return {
    id: business.id,
    href: `/${business.slug}`,
    bookHref: `/${business.slug}/book`,
    name: business.name,
    initials: initialsOf(business.name),
    logoUrl: business.logoUrl,
    summary: business.offering,
    branchLabel: `${plural(branches.length, 'branch')}: ${branches.join(', ')}`,
    branchLink: branches.length === 1 ? 'View branch' : `View ${branches.length} branches`,
    services: business.serviceNames.slice(0, SERVICES_SHOWN),
    moreServices: Math.max(0, business.serviceNames.length - SERVICES_SHOWN),
  };
}
