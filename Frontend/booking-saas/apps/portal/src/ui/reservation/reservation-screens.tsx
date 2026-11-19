// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import { Alert, Badge, Button, Card, Icon } from '@tempora/ui';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useCustomer } from '@/core/account/presentation/use-account';
import {
  useMyReservations,
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

  if (data.status === 'confirmed') {
    return (
      <ReservationPage>
        <div className="flex flex-col gap-2">
          <Badge tone="success" dot className="self-start">
            Paid
          </Badge>
          <h1 className="text-[32px] leading-tight font-extrabold">You’re booked!</h1>
          <p className="m-0 text-muted">A confirmation with your invoice is on its way by email.</p>
        </div>
        <ReservationSummaryCard reservation={data} />
        <Link href="/account/bookings" className="font-semibold text-primary-text">
          See all my bookings
        </Link>
      </ReservationPage>
    );
  }
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

/** Logged-in pages: send visitors to the login page and back. */
function useRequireCustomer(next: string) {
  const router = useRouter();
  const customer = useCustomer();
  useEffect(() => {
    if (customer.isSuccess && customer.data === null) {
      router.replace(`/login?next=${encodeURIComponent(next)}`);
    }
  }, [customer.isSuccess, customer.data, next, router]);
  return customer.data ?? null;
}

/** FSD 2.1 `/account/bookings/[id]`. */
export function MyBookingScreen({ id }: Readonly<{ id: string }>) {
  const customer = useRequireCustomer(`/account/bookings/${id}`);
  const reservation = useReservation(id);
  if (!customer || reservation.isPending) return <ReservationLoading />;
  if (reservation.isError) return <ReservationUnavailable />;
  return <ReservationDetail reservation={reservation.data} title="Booking detail" />;
}

/** FSD 2.1 `/account/bookings`: upcoming and past bookings at every business. */
export function MyBookingsScreen() {
  const customer = useRequireCustomer('/account/bookings');
  const [when, setWhen] = useState<'upcoming' | 'past'>('upcoming');
  const [page, setPage] = useState(1);
  const list = useMyReservations(when, page);
  if (!customer) return <ReservationLoading />;

  const pages = list.data ? Math.max(1, Math.ceil(list.data.total / list.data.pageSize)) : 1;
  const tab = (value: 'upcoming' | 'past', label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={when === value}
      onClick={() => {
        setWhen(value);
        setPage(1);
      }}
      className={`rounded-full px-4 py-2 text-sm font-semibold ${
        when === value ? 'bg-primary text-primary-foreground' : 'bg-surface-muted text-muted'
      }`}
    >
      {label}
    </button>
  );

  return (
    <ReservationPage>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-[32px] leading-tight font-extrabold">My bookings</h1>
        <span className="flex gap-4">
          <Link href="/account/invoices" className="font-semibold text-primary-text">
            Invoices
          </Link>
          <Link href="/account/profile" className="font-semibold text-primary-text">
            Profile and security
          </Link>
        </span>
      </div>
      {!customer.emailVerified && (
        <Alert tone="info">
          Verify your email to see bookings you made before logging in.{' '}
          <Link href="/account/profile" className="font-semibold underline">
            Profile
          </Link>
        </Alert>
      )}
      <div role="tablist" aria-label="Bookings" className="flex gap-2">
        {tab('upcoming', 'Upcoming')}
        {tab('past', 'Past')}
      </div>

      {list.isPending && <div className="h-40 animate-pulse rounded-card bg-surface-muted" />}
      {list.isError && <Alert tone="danger">Your bookings could not be loaded.</Alert>}
      {list.data?.items.length === 0 && (
        <Card className="flex flex-col gap-2 p-6">
          <p className="m-0 font-semibold">
            {when === 'upcoming' ? 'No upcoming bookings.' : 'No past bookings yet.'}
          </p>
          <Link href="/#businesses" className="font-semibold text-primary-text">
            Find a business
          </Link>
        </Card>
      )}
      {list.data && list.data.items.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {list.data.items.map((item) => (
            <li key={item.id}>
              <Link
                href={`/account/bookings/${item.id}`}
                className="block rounded-card border-2 border-border bg-surface p-4 hover:border-primary"
              >
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-extrabold">{item.serviceName}</span>
                  <Badge tone={item.statusTone} dot>
                    {item.statusLabel}
                  </Badge>
                </span>
                <span className="block text-sm text-muted">
                  {item.business.name} · {item.branchName} · with {item.therapist}
                </span>
                <span className="block text-sm font-semibold">
                  {item.when} · {item.price}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {pages > 1 && (
        <nav aria-label="Pages" className="flex items-center gap-3">
          <Button variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Previous
          </Button>
          <span className="text-sm text-muted">
            Page {page} of {pages}
          </span>
          <Button variant="secondary" disabled={page >= pages} onClick={() => setPage(page + 1)}>
            Next
          </Button>
        </nav>
      )}
    </ReservationPage>
  );
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
