// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { describe, expect, it } from 'vitest';
import { hoursOutsideOpening, timeOffProblem } from './rules.js';

const opening = [
  { weekday: 1, start: '09:00', end: '18:00' },
  { weekday: 2, start: '09:00', end: '18:00' },
];

describe('hoursOutsideOpening', () => {
  it('accepts hours inside or equal to the opening hours', () => {
    expect(
      hoursOutsideOpening(
        [
          { weekday: 1, start: '09:00', end: '18:00' },
          { weekday: 2, start: '10:30', end: '15:00' },
        ],
        opening,
      ),
    ).toEqual([]);
  });

  it('flags hours that start early, end late or fall on a closed day', () => {
    expect(
      hoursOutsideOpening(
        [
          { weekday: 1, start: '08:45', end: '17:00' },
          { weekday: 2, start: '09:00', end: '18:15' },
          { weekday: 3, start: '10:00', end: '12:00' },
        ],
        opening,
      ),
    ).toEqual([0, 1, 2]);
  });
});

describe('timeOffProblem', () => {
  const now = new Date('2026-11-19T12:00:00Z');
  const day = 24 * 60 * 60_000;
  const at = (days: number) => new Date(now.getTime() + days * day);

  it('accepts future time off up to 90 days, including leave already under way', () => {
    expect(timeOffProblem(at(1), at(2), now)).toBeNull();
    expect(timeOffProblem(at(-1), at(1), now)).toBeNull();
    expect(timeOffProblem(at(0), at(90), now)).toBeNull();
  });

  it('rejects time off in the past or longer than 90 days', () => {
    expect(timeOffProblem(at(-3), at(-2), now)).toMatch(/future/);
    expect(timeOffProblem(at(0), at(91), now)).toMatch(/90 days/);
  });
});
