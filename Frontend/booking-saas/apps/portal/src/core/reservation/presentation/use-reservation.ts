// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { formatPrice } from '../../booking/presentation/use-booking';
import { useDependencies } from '../../shared/presentation/dependencies';
import type { DemoCheckout } from '../domain/demo-checkout';
import {
  formatCountdown,
  keepWaitingForPayment,
  reserve,
  timeLeft,
  type NewReservation,
  type Reservation,
  type ReservationStatus,
  type ReservationSummary,
} from '../domain/reservation';

export type {
  Invoice,
  InvoiceSummary,
  Reservation,
  ReservationStatus,
  ReservationSummary,
} from '../domain/reservation';
export { rescheduleNotice } from '../domain/reservation';

type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

const STATUS: Record<ReservationStatus, { label: string; tone: Tone }> = {
  pending_payment: { label: 'Payment pending', tone: 'warning' },
  confirmed: { label: 'Confirmed', tone: 'success' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
  expired: { label: 'Expired', tone: 'neutral' },
  completed: { label: 'Completed', tone: 'info' },
  no_show: { label: 'Missed', tone: 'danger' },
};

export interface ReservationView extends ReservationSummary {
  /** "Mon, 23 Nov 2026 · 10:00–11:00", in the business's time zone. */
  when: string;
  price: string;
  statusLabel: string;
  statusTone: Tone;
}

export function toReservationView(reservation: ReservationSummary): ReservationView {
  const day = new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: reservation.timeZone,
  }).format(reservation.startsAt);
  const time = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: reservation.timeZone,
  });
  return {
    ...reservation,
    when: `${day} · ${time.format(reservation.startsAt)}–${time.format(reservation.endsAt)}`,
    price: formatPrice(reservation.priceCents),
    statusLabel: STATUS[reservation.status].label,
    statusTone: STATUS[reservation.status].tone,
  };
}

const key = (id: string) => ['reservation', id] as const;

/** Step 3 → payment: books, keeps the access token for this tab, then goes to Checkout. */
export function useReserve() {
  const { reservations, bookingAccess } = useDependencies();
  return useMutation({
    mutationFn: ({ input, idempotencyKey }: { input: NewReservation; idempotencyKey: string }) =>
      reserve(reservations, bookingAccess, input, idempotencyKey),
  });
}

/**
 * One booking, through the session or this tab's access token. With `waitForPayment` it
 * polls until the payment webhook has decided (FSD 6.4 "does not trust the redirect").
 */
export function useReservation(id: string, { waitForPayment = false } = {}) {
  const { reservations, bookingAccess } = useDependencies();
  const [since] = useState(() => new Date());
  return useQuery({
    queryKey: key(id),
    queryFn: () => reservations.get(id, bookingAccess.get(id)),
    retry: false,
    refetchInterval: (query) =>
      waitForPayment && keepWaitingForPayment(query.state.data?.status, since, new Date())
        ? 2000
        : false,
  });
}

/** `/manage/[token]`: opens the booking and keeps the token for its other pages. */
export function useReservationByLink(token: string) {
  const { reservations, bookingAccess } = useDependencies();
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: ['reservation', 'link', token],
    queryFn: async () => {
      const reservation = await reservations.getByLink(token);
      bookingAccess.save(reservation.id, token);
      queryClient.setQueryData(key(reservation.id), reservation);
      return reservation;
    },
    retry: false,
  });
}

export function useMyReservations(when: 'upcoming' | 'past', page: number) {
  const { reservations } = useDependencies();
  return useQuery({
    queryKey: ['reservations', when, page],
    queryFn: () => reservations.list(when, page),
    placeholderData: keepPreviousData,
    select: (result) => ({ ...result, items: result.items.map(toReservationView) }),
  });
}

/** "Pay now": back to the Checkout that is still open. */
export function useResumePayment(id: string) {
  const { reservations, bookingAccess } = useDependencies();
  return useMutation({
    mutationFn: () => reservations.resumePayment(id, bookingAccess.get(id)),
  });
}

export function useCancelReservation(id: string) {
  const { reservations, bookingAccess } = useDependencies();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => reservations.cancel(id, bookingAccess.get(id)),
    onSuccess: (reservation: Reservation) => {
      queryClient.setQueryData(key(id), reservation);
      void queryClient.invalidateQueries({ queryKey: ['reservations'] });
    },
  });
}

/** "29:05" counting down to `payBy`, updated every second; "0:00" when time is up. */
export function useCountdown(payBy: Date | null) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!payBy) return;
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, [payBy]);
  const left = timeLeft(payBy, now);
  return { label: formatCountdown(left), expired: payBy !== null && left === 0 };
}

export function useDemoCheckout(sessionId: string, tenantId: string | null) {
  const { demoCheckout } = useDependencies();
  return useQuery({
    queryKey: ['demo-checkout', sessionId, tenantId],
    queryFn: () => demoCheckout.get(sessionId, tenantId!),
    enabled: !!tenantId,
    retry: false,
    select: (checkout: DemoCheckout) => ({
      ...checkout,
      amount: formatPrice(checkout.amountCents),
    }),
  });
}

export function useCompleteDemoCheckout(sessionId: string, tenantId: string | null) {
  const { demoCheckout } = useDependencies();
  return useMutation({
    mutationFn: (outcome: 'paid' | 'expired') =>
      demoCheckout.complete(sessionId, tenantId!, outcome),
  });
}

/** Free times to move a booking to, shown in the business's time zone. */
export function useRescheduleSlots(
  id: string,
  query: { date: string; staffId: string } | null,
  timeZone: string | undefined,
) {
  const { reservations, bookingAccess } = useDependencies();
  return useQuery({
    queryKey: ['reservation', id, 'reschedule-slots', query],
    queryFn: () => reservations.rescheduleSlots(id, bookingAccess.get(id), query!),
    enabled: !!query && !!timeZone,
    retry: false,
    select: (slots) => {
      const time = new Intl.DateTimeFormat('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone,
      });
      return slots.map((slot) => ({
        key: slot.startsAt.toISOString(),
        startsAt: slot.startsAt,
        label: time.format(slot.startsAt),
      }));
    },
  });
}

export function useReschedule(id: string) {
  const { reservations, bookingAccess } = useDependencies();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { startsAt: Date; staffId: string }) =>
      reservations.reschedule(id, bookingAccess.get(id), input),
    onSuccess: (reservation: Reservation) => {
      queryClient.setQueryData(key(id), reservation);
      void queryClient.invalidateQueries({ queryKey: ['reservations'] });
      void queryClient.invalidateQueries({ queryKey: ['reservation', id, 'reschedule-slots'] });
    },
  });
}

export function useInvoice(id: string) {
  const { reservations, bookingAccess } = useDependencies();
  return useQuery({
    queryKey: ['reservation', id, 'invoice'],
    queryFn: () => reservations.invoice(id, bookingAccess.get(id)),
    retry: false,
  });
}

export function useMyInvoices(page: number) {
  const { reservations } = useDependencies();
  return useQuery({
    queryKey: ['invoices', page],
    queryFn: () => reservations.invoices(page),
    placeholderData: keepPreviousData,
  });
}
