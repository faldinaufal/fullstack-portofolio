// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { describe, expect, it } from 'vitest';
import { summarizeOffering } from '../directory/data/http-business-repository';
import { bookableDays, dateIn, summarizeHours, therapistsFor } from './domain/booking';
import { formatDuration, formatPrice } from './presentation/use-booking';

const NY = 'America/New_York';
const weekdays = [1, 2, 3, 4, 5].map((weekday) => ({
  weekday,
  opensAt: '09:00',
  closesAt: '18:00',
}));

describe('summarizeHours', () => {
  it('groups consecutive days with the same hours', () => {
    expect(summarizeHours([...weekdays, { weekday: 6, opensAt: '10:00', closesAt: '14:00' }])).toBe(
      'Mon–Fri 09:00–18:00 · Sat 10:00–14:00',
    );
    expect(summarizeHours([])).toBe('Closed');
  });
});

describe('dates in the business time zone', () => {
  it("uses the business's calendar date, not the visitor's", () => {
    // 03:00 UTC on the 19th is still the 18th in New York.
    expect(dateIn(NY, new Date('2026-11-19T03:00:00Z'))).toBe('2026-11-18');
  });

  it('lists today up to the horizon and marks closed weekdays and closures', () => {
    const days = bookableDays(
      {
        openingHours: weekdays,
        closures: [{ startsOn: '2026-11-20', endsOn: '2026-11-20', reason: 'Holiday' }],
      },
      3,
      NY,
      new Date('2026-11-18T15:00:00Z'), // Wednesday in New York
    );
    expect(days).toEqual([
      { date: '2026-11-18', weekday: 3, open: true },
      { date: '2026-11-19', weekday: 4, open: true },
      { date: '2026-11-20', weekday: 5, open: false }, // closure
      { date: '2026-11-21', weekday: 6, open: false }, // Saturday: closed
    ]);
  });
});

it('keeps only the therapists who perform the chosen service', () => {
  const branch = {
    therapists: [
      { id: 'a', displayName: 'Ines H.', serviceIds: ['massage'] },
      { id: 'b', displayName: 'Omar H.', serviceIds: ['physio', 'massage'] },
      { id: 'c', displayName: 'Daniel K.', serviceIds: ['physio'] },
    ],
  };
  expect(therapistsFor(branch, 'physio').map((t) => t.id)).toEqual(['b', 'c']);
});

describe('formatting', () => {
  it('formats prices from integer cents and durations in hours and minutes', () => {
    expect(formatPrice(4217)).toBe('$42.17');
    expect(formatDuration(45)).toBe('45 min');
    expect(formatDuration(60)).toBe('1 h');
    expect(formatDuration(90)).toBe('1 h 30 min');
  });

  it('summarizes what a business offers in the directory', () => {
    expect(summarizeOffering([])).toBe('Services coming soon');
    expect(summarizeOffering(['Massage', 'Physiotherapy'])).toBe('Massage, Physiotherapy');
    expect(summarizeOffering(['A', 'B', 'C', 'D'])).toBe('A, B +2 more');
  });
});
