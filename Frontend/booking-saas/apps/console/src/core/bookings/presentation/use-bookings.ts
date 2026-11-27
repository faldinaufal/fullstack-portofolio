// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDependencies } from '../../shared/presentation/dependencies';
import type { BookingDetail, BookingFilters, BookingRow, BookingStatus } from '../domain/booking';

export type {
  BookingDetail,
  BookingFilters,
  BookingRow,
  BookingStatus,
  CalendarBooking,
  CalendarData,
} from '../domain/booking';
export { addDays, dateIn, minutesInDay, placeBlock } from '../domain/booking';

type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export const STATUS: Record<BookingStatus, { label: string; tone: Tone }> = {
  pending_payment: { label: 'Awaiting payment', tone: 'warning' },
  confirmed: { label: 'Confirmed', tone: 'success' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
  expired: { label: 'Expired', tone: 'neutral' },
  completed: { label: 'Completed', tone: 'info' },
  no_show: { label: 'No-show', tone: 'danger' },
};

/** Labels for the audit actions shown in a booking's timeline. */
const ACTIONS: Record<string, string> = {
  'booking.created': 'Booked',
  'booking.confirmed': 'Paid and confirmed',
  'booking.rescheduled': 'Moved to a new time',
  'booking.reassigned': 'Given to another therapist',
  'booking.cancelled': 'Cancelled',
  'booking.expired': 'Hold expired, not paid',
  'booking.completed': 'Marked completed',
  'booking.no_show': 'Marked no-show',
  'payment.needs_attention': 'Payment needs attention',
};
export const actionLabel = (action: string) => ACTIONS[action] ?? action;

export const formatPrice = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);

/** "Mon 23 Nov · 10:00–11:00" in the business's time zone. */
export function formatWhen(row: Pick<BookingRow, 'startsAt' | 'endsAt'>, timeZone: string) {
  const day = new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone,
  }).format(row.startsAt);
  const time = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone });
  return `${day} · ${time.format(row.startsAt)}–${time.format(row.endsAt)}`;
}

export const timeIn = (instant: Date, timeZone: string) =>
  new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone }).format(
    instant,
  );

export function useBookings(filters: BookingFilters) {
  const { bookings } = useDependencies();
  return useQuery({
    queryKey: ['bookings', filters],
    queryFn: () => bookings.list(filters),
    placeholderData: keepPreviousData,
  });
}

/** CSV download link for the current filters (FSD 5.1). */
export function useBookingsExportUrl(filters: BookingFilters) {
  const { bookings } = useDependencies();
  return bookings.exportUrl(filters);
}

export function useBooking(id: string) {
  const { bookings } = useDependencies();
  return useQuery({ queryKey: ['booking', id], queryFn: () => bookings.get(id), retry: false });
}

export function useCalendar(range: { from: string; to: string; branchId?: string }) {
  const { bookings } = useDependencies();
  return useQuery({
    queryKey: ['calendar', range],
    queryFn: () => bookings.calendar(range),
    placeholderData: keepPreviousData,
  });
}

export function useMoveSlots(id: string, query: { date: string; staffId: string } | null) {
  const { bookings } = useDependencies();
  return useQuery({
    queryKey: ['booking', id, 'slots', query],
    queryFn: () => bookings.slots(id, query!),
    enabled: !!query,
    retry: false,
  });
}

/** Every action returns the updated booking; lists and calendars are refreshed after it. */
function useBookingAction<TInput>(id: string, run: (input: TInput) => Promise<BookingDetail>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: (detail) => {
      queryClient.setQueryData(['booking', id], detail);
      void queryClient.invalidateQueries({ queryKey: ['bookings'] });
      void queryClient.invalidateQueries({ queryKey: ['calendar'] });
      void queryClient.invalidateQueries({ queryKey: ['booking', id, 'slots'] });
    },
  });
}

export function useBookingActions(id: string) {
  const { bookings } = useDependencies();
  return {
    reschedule: useBookingAction(id, (input: { startsAt: Date; staffId?: string }) =>
      bookings.reschedule(id, input),
    ),
    reassign: useBookingAction(id, (staffId: string) => bookings.reassign(id, staffId)),
    cancel: useBookingAction(id, (reason: string | undefined) => bookings.cancel(id, reason)),
    complete: useBookingAction(id, (_: void) => bookings.complete(id)),
    noShow: useBookingAction(id, (_: void) => bookings.noShow(id)),
  };
}
