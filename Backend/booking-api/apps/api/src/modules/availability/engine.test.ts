// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { describe, expect, it } from 'vitest';
import {
  availableSlots,
  todayIn,
  wallTimeToInstant,
  weekdayOf,
  type AvailabilityInput,
} from './engine.js';

const NY = 'America/New_York';

/** Wednesday 2026-11-18, 08:00 in New York (13:00 UTC, standard time). */
const base: AvailabilityInput = {
  date: '2026-11-20',
  timeZone: NY,
  now: new Date('2026-11-18T13:00:00Z'),
  settings: { minLeadHours: 4, maxAdvanceDays: 30 },
  service: { durationMinutes: 60, bufferMinutes: 15 },
  opening: { start: '09:00', end: '13:00' },
  working: { start: '09:00', end: '13:00' },
  closed: false,
  busy: [],
};

/** Slot start times as New York wall-clock `HH:MM`. */
const wall = (input: AvailabilityInput) =>
  availableSlots(input).map((slot) =>
    slot.startsAt.toLocaleTimeString('en-GB', { timeZone: NY, hour: '2-digit', minute: '2-digit' }),
  );

describe('availableSlots (FSD 6.2)', () => {
  it('lists 30-minute starts whose session fits in the opening and working hours', () => {
    expect(wall(base)).toEqual(['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00']);
  });

  it('lets the buffer run past closing time, but not the session', () => {
    const slots = availableSlots(base);
    expect(slots.at(-1)?.endsAt.toISOString()).toBe('2026-11-20T18:00:00.000Z'); // 13:00 New York
  });

  it('uses the overlap of opening and working hours', () => {
    expect(wall({ ...base, working: { start: '10:15', end: '12:30' } })).toEqual([
      '10:30',
      '11:00',
      '11:30',
    ]);
  });

  it('returns nothing on a closure, a closed day or a day off', () => {
    expect(availableSlots({ ...base, closed: true })).toEqual([]);
    expect(availableSlots({ ...base, opening: null })).toEqual([]);
    expect(availableSlots({ ...base, working: null })).toEqual([]);
  });

  it('respects the minimum lead time', () => {
    // now = 08:00 on the 20th; 4 h lead → first start 12:00.
    expect(wall({ ...base, now: new Date('2026-11-20T13:00:00Z') })).toEqual(['12:00']);
  });

  it('respects the booking horizon and never lists past days', () => {
    expect(availableSlots({ ...base, settings: { minLeadHours: 0, maxAdvanceDays: 1 } })).toEqual(
      [],
    );
    expect(availableSlots({ ...base, date: '2026-11-17' })).toEqual([]);
    expect(wall({ ...base, date: '2026-12-18' })).toHaveLength(7); // exactly 30 days ahead
    expect(availableSlots({ ...base, date: '2026-12-19' })).toEqual([]);
  });

  it('skips starts whose blocked range (session + buffer) overlaps a busy range', () => {
    // Time off 11:00–11:30: a 10:00 session ends 11:00 but its buffer runs to 11:15.
    const busy = [
      { start: new Date('2026-11-20T16:00:00Z'), end: new Date('2026-11-20T16:30:00Z') },
    ];
    // 09:30 + 60 min + 15 min buffer ends 10:45: still free. 10:00, 10:30, 11:00 are blocked.
    expect(wall({ ...base, busy })).toEqual(['09:00', '09:30', '11:30', '12:00']);
  });

  it('a range ending exactly at a start does not block it ([) ranges)', () => {
    const busy = [
      { start: new Date('2026-11-20T14:00:00Z'), end: new Date('2026-11-20T15:00:00Z') },
    ];
    expect(wall({ ...base, busy })[0]).toBe('10:00');
  });
});

describe('time zone handling', () => {
  it('maps wall-clock times to instants across standard and daylight time', () => {
    expect(wallTimeToInstant('2026-11-20', 9 * 60, NY)?.toISOString()).toBe(
      '2026-11-20T14:00:00.000Z',
    );
    expect(wallTimeToInstant('2026-07-20', 9 * 60, NY)?.toISOString()).toBe(
      '2026-07-20T13:00:00.000Z',
    );
  });

  it('skips the hour that does not exist when clocks go forward (2026-03-08)', () => {
    expect(wallTimeToInstant('2026-03-08', 2 * 60 + 30, NY)).toBeNull();
    const night = { ...base, date: '2026-03-08', now: new Date('2026-03-01T00:00:00Z') };
    const slots = wall({
      ...night,
      service: { durationMinutes: 30, bufferMinutes: 0 },
      opening: { start: '01:00', end: '04:00' },
      working: { start: '01:00', end: '04:00' },
    });
    expect(slots).toEqual(['01:00', '01:30', '03:00', '03:30']);
  });

  it('uses the first occurrence on the night clocks go back (2026-11-01)', () => {
    expect(wallTimeToInstant('2026-11-01', 60 + 30, NY)?.toISOString()).toBe(
      '2026-11-01T05:30:00.000Z',
    );
  });

  it("knows today's date and weekday in the platform zone", () => {
    // 03:00 UTC on the 19th is still the 18th in New York.
    expect(todayIn(NY, new Date('2026-11-19T03:00:00Z'))).toBe('2026-11-18');
    expect(weekdayOf('2026-11-18')).toBe(3);
  });
});
