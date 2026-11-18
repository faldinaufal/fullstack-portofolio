// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { describe, expect, it } from 'vitest';
import { openingHoursProblems, summarizeOpeningHours } from './opening-hours';

const weekdays = [1, 2, 3, 4, 5].map((weekday) => ({
  weekday,
  opensAt: '09:00',
  closesAt: '18:00',
}));

describe('summarizeOpeningHours', () => {
  it('groups consecutive days with the same hours', () => {
    expect(
      summarizeOpeningHours([...weekdays, { weekday: 6, opensAt: '10:00', closesAt: '14:00' }]),
    ).toBe('Mon–Fri 09:00–18:00 · Sat 10:00–14:00');
  });

  it('does not group across a closed day, and lists Sunday last', () => {
    const hours = [
      { weekday: 1, opensAt: '09:00', closesAt: '17:00' },
      { weekday: 3, opensAt: '09:00', closesAt: '17:00' },
      { weekday: 0, opensAt: '10:00', closesAt: '13:00' },
    ];
    expect(summarizeOpeningHours(hours)).toBe(
      'Mon 09:00–17:00 · Wed 09:00–17:00 · Sun 10:00–13:00',
    );
  });

  it('says when the branch is closed all week', () => {
    expect(summarizeOpeningHours([])).toBe('Closed all week');
  });
});

describe('openingHoursProblems', () => {
  it('accepts valid hours in 15-minute steps', () => {
    expect(openingHoursProblems(weekdays)).toEqual({});
  });

  it('flags reversed hours and times off the 15-minute grid, per weekday', () => {
    expect(
      openingHoursProblems([
        { weekday: 1, opensAt: '18:00', closesAt: '09:00' },
        { weekday: 2, opensAt: '09:10', closesAt: '17:00' },
      ]),
    ).toEqual({
      1: 'Closing time must be after opening time.',
      2: 'Use HH:MM in 15-minute steps.',
    });
  });
});
