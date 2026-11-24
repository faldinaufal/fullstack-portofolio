// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { describe, expect, it } from 'vitest';
import { initialsOf, toBusinessCard } from './featured-businesses.view-model';

describe('toBusinessCard', () => {
  it('builds the card text and links', () => {
    expect(
      toBusinessCard({
        id: 'x',
        slug: 'harbor-physio',
        name: 'harbor Physio Clinic',
        offering: 'Physio Assessment, Follow-up Physio +2 more',
        serviceNames: [
          'Physio Assessment',
          'Follow-up Physio',
          'Dry Needling',
          'Hot Stone Massage',
        ],
        branchNames: ['Harbor'],
        logoUrl: 'https://files.example/tenants/x/logo/a.png',
      }),
    ).toEqual({
      id: 'x',
      href: '/harbor-physio',
      bookHref: '/harbor-physio/book',
      name: 'harbor Physio Clinic',
      initials: 'HP',
      logoUrl: 'https://files.example/tenants/x/logo/a.png',
      summary: 'Physio Assessment, Follow-up Physio +2 more',
      branchLabel: '1 branch: Harbor',
      branchLink: 'View branch',
      services: ['Physio Assessment', 'Follow-up Physio', 'Dry Needling'],
      moreServices: 1,
    });
  });

  it('counts several branches', () => {
    const card = toBusinessCard({
      id: 'l',
      slug: 'lumen',
      name: 'Lumen Wellness Studio',
      offering: 'Swedish Massage',
      serviceNames: ['Swedish Massage'],
      branchNames: ['Downtown', 'Riverside', 'Northgate'],
      logoUrl: null,
    });
    expect(card.branchLabel).toBe('3 branches: Downtown, Riverside, Northgate');
    expect(card.branchLink).toBe('View 3 branches');
    expect(card.moreServices).toBe(0);
  });
});

describe('initialsOf', () => {
  it('takes the first letter of the first two words', () => {
    expect(initialsOf('Lumen Wellness Studio')).toBe('LW');
    expect(initialsOf('  aura ')).toBe('A');
  });
});
