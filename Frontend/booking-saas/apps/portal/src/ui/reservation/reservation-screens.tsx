// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import { Card, Icon } from '@tempora/ui';
import { useSearchParams } from 'next/navigation';
import {
  useReservation,
  useReservationByLink,
} from '@/core/reservation/presentation/use-reservation';
import {
  PaymentActions,
  ReservationDetail,
  ReservationLoading,
  ReservationPage,
  ReservationSummaryCard,
  ReservationUnavailable,
} from './reservation-parts';
import { useRequireCustomer } from './account-page';
import { ConfirmedView } from './confirmation-view';

/** FSD 2.1 `/bookings/[id]/pay`: countdown, "Pay now", "Cancel". */
export function PayScreen({ id }: Readonly<{ id: string }>) {
  const reservation = useReservation(id);
  if (reservation.isPending) return <ReservationLoading />;
  if (reservation.isError) return <ReservationUnavailable />;
  const data = reservation.data;
  if (data.status !== 'pending_payment') {
    return <ReservationDetail reservation={data} title="Your booking" />;
  }
  return (
    <ReservationPage>
      <h1 className="text-[32px] leading-tight font-extrabold">Payment pending</h1>
      <ReservationSummaryCard reservation={data} />
      <PaymentActions reservation={data} />
    </ReservationPage>
  );
}

/**
 * FSD 2.1 `/bookings/[id]/confirmation`: the page Checkout returns to. It does not trust the
 * redirect and waits until the payment webhook has confirmed or released the booking.
 */
export function ConfirmationScreen({ id }: Readonly<{ id: string }>) {
  const reservation = useReservation(id, { waitForPayment: true });
  if (reservation.isPending) return <ReservationLoading />;
  if (reservation.isError) return <ReservationUnavailable />;
  const data = reservation.data;

  if (data.status === 'confirmed') return <ConfirmedView reservation={data} />;
  if (data.status === 'pending_payment') {
    return (
      <ReservationPage>
        <h1 className="text-[32px] leading-tight font-extrabold">Confirming your payment…</h1>
        <Card className="flex items-center gap-3 p-5" aria-live="polite">
          <Icon name="timer" size={20} />
          <span>
            {reservation.isFetching
              ? 'Waiting for the payment provider. This usually takes a few seconds.'
              : 'This is taking longer than usual. We will email you as soon as the payment is confirmed.'}
          </span>
        </Card>
        <ReservationSummaryCard reservation={data} />
        {!reservation.isFetching && <PaymentActions reservation={data} />}
      </ReservationPage>
    );
  }
  return <ReservationDetail reservation={data} title="Your booking" />;
}

/** FSD 2.1 `/manage/[token]`: the guest's booking, opened from the emailed link. */
export function ManageScreen({ token }: Readonly<{ token: string }>) {
  const reservation = useReservationByLink(token);
  if (reservation.isPending) return <ReservationLoading />;
  if (reservation.isError) return <ReservationUnavailable />;
  return <ReservationDetail reservation={reservation.data} title="Your booking" />;
}

/** FSD 2.1 `/account/bookings/[id]`. */
export function MyBookingScreen({ id }: Readonly<{ id: string }>) {
  const customer = useRequireCustomer(`/account/bookings/${id}`);
  const reservation = useReservation(id);
  if (!customer || reservation.isPending) return <ReservationLoading />;
  if (reservation.isError) return <ReservationUnavailable />;
  return <ReservationDetail reservation={reservation.data} title="Booking detail" />;
}

/** `/bookings/[id]`: one booking for customers and guests (session or this tab's link). */
export function BookingScreen({ id }: Readonly<{ id: string }>) {
  const rescheduled = useSearchParams().get('rescheduled') === '1';
  const reservation = useReservation(id);
  if (reservation.isPending) return <ReservationLoading />;
  if (reservation.isError) return <ReservationUnavailable />;
  return (
    <ReservationDetail
      reservation={reservation.data}
      title="Your booking"
      notice={rescheduled ? 'Your booking was moved. We emailed you the new time.' : undefined}
    />
  );
}
