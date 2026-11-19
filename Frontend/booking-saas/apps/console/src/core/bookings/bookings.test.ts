// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { describe, expect, it } from 'vitest';
import { toBookingDetail } from './data/http-booking-repository';
import { addDays, dateIn, minutesInDay, placeBlock } from './domain/booking';
import { actionLabel, formatWhen } from './presentation/use-bookings';

const NY = 'America/New_York';

describe('calendar placement (business clock)', () => {
  // Monday 23 November 2026, 10:00–11:00 in New York (UTC−5), with a 15-minute buffer.
  const booking = {
    startsAt: new Date('2026-11-23T15:00:00Z'),
    endsAt: new Date('2026-11-23T16:00:00Z'),
    blockedUntil: new Date('2026-11-23T16:15:00Z'),
  };

  it('uses the business’s wall clock, not the visitor’s', () => {
    expect(minutesInDay(booking.startsAt, NY)).toBe(600);
    expect(dateIn(NY, new Date('2026-11-24T03:00:00Z'))).toBe('2026-11-23');
    expect(addDays('2026-11-30', 2)).toBe('2026-12-02');
  });

  it('places a session and its buffer in the visible hours', () => {
    expect(placeBlock(booking, '2026-11-23', NY, 7, 21)).toEqual({
      top: 180,
      height: 60,
      bufferHeight: 15,
    });
  });

  it('cuts at the edges and skips what is not visible', () => {
    expect(placeBlock(booking, '2026-11-23', NY, 10, 11)).toEqual({
      top: 0,
      height: 60,
      bufferHeight: 0,
    });
    expect(placeBlock(booking, '2026-11-23', NY, 12, 21)).toBeNull();
  });
});

describe('booking detail', () => {
  it('maps dates and keeps actions and the timeline', () => {
    const detail = toBookingDetail({
      id: 'fa1d0000-0000-4000-8000-000000004217',
      status: 'confirmed',
      startsAt: '2026-11-23T15:00:00.000Z',
      endsAt: '2026-11-23T16:00:00.000Z',
      serviceName: 'Deep Tissue Massage',
      priceCents: 4217,
      branch: { id: 'fa1d0000-0000-4000-8000-000000000011', name: 'Downtown' },
      therapist: { id: 'fa1d0000-0000-4000-8000-000000000012', name: 'Ines Halvorsen' },
      customer: {
        id: 'fa1d0000-0000-4000-8000-000000000013',
        name: 'Omar Haddad',
        email: null,
        phone: null,
      },
      invoice: { number: 'LUM-2026-000001', status: 'paid' },
      notes: 'Lower back',
      durationMinutes: 60,
      bufferMinutes: 15,
      serviceId: 'fa1d0000-0000-4000-8000-000000000014',
      holdExpiresAt: null,
      cancelReason: null,
      refundHandledExternally: false,
      markedAt: null,
      customerRescheduleCount: 0,
      timeZone: NY,
      actions: {
        reschedule: false,
        reassign: false,
        cancel: false,
        cancelNeedsReason: true,
        complete: true,
        noShow: true,
      },
      timeline: [
        {
          at: '2026-11-20T10:00:00.000Z',
          actor: 'Omar Haddad (guest)',
          action: 'booking.created',
          reason: null,
          before: null,
          after: null,
        },
      ],
    });
    expect(detail.startsAt).toEqual(new Date('2026-11-23T15:00:00Z'));
    expect(detail.customer.email).toBeNull();
    expect(detail.timeline[0]!.at).toEqual(new Date('2026-11-20T10:00:00Z'));
    expect(formatWhen(detail, NY)).toBe('Mon 23 Nov · 10:00–11:00');
    expect(actionLabel('booking.reassigned')).toBe('Given to another therapist');
    expect(actionLabel('something.new')).toBe('something.new');
  });
});
