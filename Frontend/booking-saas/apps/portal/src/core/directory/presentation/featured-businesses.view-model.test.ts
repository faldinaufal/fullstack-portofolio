import { describe, expect, it } from 'vitest';
import { toBusinessCard } from './featured-businesses.view-model';

describe('toBusinessCard', () => {
  it('builds the card text and link', () => {
    expect(
      toBusinessCard({
        id: 'x',
        slug: 'harbor-physio',
        name: 'harbor Physio Clinic',
        offering: 'Physiotherapy',
        branchNames: ['Harbor'],
      }),
    ).toEqual({
      id: 'x',
      href: '/harbor-physio',
      name: 'harbor Physio Clinic',
      initial: 'H',
      summary: 'Physiotherapy · 1 branch',
      branches: ['Harbor'],
    });
  });
});
