// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { describe, expect, it } from 'vitest';
import { toGrants } from './data/http-support-repository';
import { durationLabel, timeLeft } from './domain/support';

const now = new Date('2026-11-23T15:00:00Z');
const at = (iso: string) => ({ expiresAt: new Date(iso) });

describe('support access (FSD 1.4)', () => {
  it('shows the time left, nothing once it ended', () => {
    expect(timeLeft(at('2026-11-23T15:40:00Z'), now)).toBe('40 min');
    expect(timeLeft(at('2026-11-23T17:15:00Z'), now)).toBe('2 h 15 min');
    expect(timeLeft(at('2026-11-24T15:00:00Z'), now)).toBe('24 h');
    expect(timeLeft(at('2026-11-23T15:00:00Z'), now)).toBeNull();
    expect(durationLabel(1)).toBe('1 hour');
    expect(durationLabel(72)).toBe('72 hours');
  });

  it('maps grants and their dates', () => {
    const grant = {
      id: 'fa1d0000-0000-4000-8000-000000004217',
      status: 'active' as const,
      startsAt: '2026-11-23T14:00:00.000Z',
      expiresAt: '2026-11-23T15:00:00.000Z',
      revokedAt: null,
      grantedBy: 'Ines Halvorsen',
    };
    const grants = toGrants({ active: grant, items: [grant] });
    expect(grants.active?.expiresAt).toEqual(new Date('2026-11-23T15:00:00Z'));
    expect(grants.items[0]!.revokedAt).toBeNull();
    expect(toGrants({ active: null, items: [] }).active).toBeNull();
  });
});
