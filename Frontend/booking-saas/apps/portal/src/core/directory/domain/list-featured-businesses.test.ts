// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { describe, expect, it } from 'vitest';
import type { Business } from './business';
import { createListFeaturedBusinesses } from './list-featured-businesses';

const business = (overrides: Partial<Business>): Business => ({
  id: 'b1',
  slug: 'lumen',
  name: 'Lumen Wellness Studio',
  offering: 'Massage and physiotherapy',
  branchNames: ['Downtown'],
  ...overrides,
});

describe('listFeaturedBusinesses', () => {
  it('hides businesses that have no branch yet', async () => {
    const list = createListFeaturedBusinesses({
      search: async () => [business({ id: 'a' }), business({ id: 'b', branchNames: [] })],
    });

    await expect(list()).resolves.toEqual([business({ id: 'a' })]);
  });
});
