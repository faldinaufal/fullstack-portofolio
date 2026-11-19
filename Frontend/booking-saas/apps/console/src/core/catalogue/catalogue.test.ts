// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { describe, expect, it } from 'vitest';
import { weekHoursProblems } from '../shared/domain/week-hours';
import { canEditSchedule } from '../team/domain/team';
import { formatDollars, parseDollars, serviceProblems } from './domain/catalogue';
import { toServiceRow } from './presentation/use-catalogue';

const massage = {
  name: 'Deep Tissue Massage',
  description: null,
  durationMinutes: 60,
  bufferMinutes: 15,
  priceCents: 4217,
};

describe('money (integer cents, FSD 4.1)', () => {
  it('parses dollars into cents without floating-point drift', () => {
    expect(parseDollars('42.17')).toBe(4217);
    expect(parseDollars('$1,000')).toBe(100_000);
    expect(parseDollars('0.29')).toBe(29);
    expect(parseDollars('42.175')).toBeNaN();
    expect(parseDollars('abc')).toBeNaN();
  });

  it('formats cents as US dollars', () => {
    expect(formatDollars(4217)).toBe('$42.17');
  });
});

describe('serviceProblems (FSD 6.12)', () => {
  it('accepts a valid service', () => {
    expect(serviceProblems(massage)).toEqual({});
  });

  it('flags each rule separately', () => {
    expect(
      serviceProblems({
        ...massage,
        name: 'X',
        durationMinutes: 50,
        bufferMinutes: 7,
        priceCents: 1_000_001,
      }),
    ).toEqual({
      name: expect.any(String),
      durationMinutes: expect.any(String),
      bufferMinutes: expect.any(String),
      priceCents: expect.any(String),
    });
  });
});

it('describes a service for the catalogue list', () => {
  expect(
    toServiceRow({ ...massage, id: 's', archived: false, version: 1, therapists: 2 }),
  ).toMatchObject({
    price: '$42.17',
    timing: '60 min + 15 min buffer',
    therapistsLabel: '2 therapists',
  });
  expect(
    toServiceRow({
      ...massage,
      bufferMinutes: 0,
      id: 's',
      archived: false,
      version: 1,
      therapists: 0,
    }),
  ).toMatchObject({ timing: '60 min', therapistsLabel: 'No therapist yet' });
});

describe('schedules', () => {
  it('validates a week of hours per weekday', () => {
    expect(
      weekHoursProblems([
        { weekday: 1, start: '09:00', end: '17:00' },
        { weekday: 2, start: '17:00', end: '09:00' },
        { weekday: 3, start: '09:05', end: '17:00' },
      ]),
    ).toEqual({ 2: 'The end must be after the start.', 3: 'Use HH:MM in 15-minute steps.' });
  });

  it('lets the owner and the branch manager edit a schedule', () => {
    const downtown = { branch: { id: 'downtown', name: 'Downtown' } };
    expect(canEditSchedule({ role: 'owner', branchId: null }, downtown)).toBe(true);
    expect(canEditSchedule({ role: 'manager', branchId: 'downtown' }, downtown)).toBe(true);
    expect(canEditSchedule({ role: 'manager', branchId: 'riverside' }, downtown)).toBe(false);
    expect(canEditSchedule({ role: 'staff', branchId: 'downtown' }, downtown)).toBe(false);
  });
});
