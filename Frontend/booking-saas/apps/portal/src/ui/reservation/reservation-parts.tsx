// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import { Alert, Badge, Button, buttonVariants, Card, ConfirmDialog, Icon } from '@tempora/ui';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { formatPrice } from '@/core/booking/presentation/use-booking';
import {
  toReservationView,
  rescheduleNotice,
  useCancelReservation,
  useCountdown,
  useResumePayment,
  type Reservation,
} from '@/core/reservation/presentation/use-reservation';
import { toRequestErrorView } from '@/core/shared/presentation/error-view';
import { RequestErrorAlert } from '@/ui/common/request-error';

const INVOICE_STATUS = { open: 'Open', paid: 'Paid', void: 'Void' } as const;

/** Narrow page column for the booking pages. */
export function ReservationPage({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <main className="px-4 py-10 sm:px-6">
      <div className="mx-auto flex max-w-[760px] flex-col gap-6">{children}</div>
    </main>
  );
}

export function ReservationLoading() {
  return (
    <ReservationPage>
      <div className="h-72 animate-pulse rounded-card bg-surface-muted" />
    </ReservationPage>
  );
}

/** Same answer for "not yours", "link expired" and "does not exist" (the API's 404). */
export function ReservationUnavailable() {
  return (
    <ReservationPage>
      <Card className="flex flex-col gap-3 p-6">
        <h1 className="text-2xl font-extrabold">This booking cannot be opened here</h1>
        <p className="text-muted">
          Open it from the link in your booking email, or log in with the account you booked with.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/login?next=/account/bookings" className="font-semibold text-primary-text">
            Log in
          </Link>
          <Link href="/" className="font-semibold text-primary-text">
            Find a business
          </Link>
        </div>
      </Card>
    </ReservationPage>
  );
}

/** What was booked, where and when, with the invoice. */
export function ReservationSummaryCard({ reservation }: Readonly<{ reservation: Reservation }>) {
  const view = toReservationView(reservation);
  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <span>
          <span className="block text-xl font-extrabold">{view.serviceName}</span>
          <Link href={`/${view.business.slug}`} className="text-sm font-semibold text-primary-text">
            {view.business.name}
          </Link>
        </span>
        <Badge tone={view.statusTone} dot>
          {view.statusLabel}
        </Badge>
      </div>
      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-muted">When</dt>
        <dd className="m-0 font-semibold">
          {view.when} <span className="font-normal text-muted">({view.timeZone})</span>
        </dd>
        <dt className="text-muted">Therapist</dt>
        <dd className="m-0">{view.therapist}</dd>
        <dt className="text-muted">Where</dt>
        <dd className="m-0">
          {view.branchName}
          {reservation.branchAddress && `, ${reservation.branchAddress}`}
        </dd>
        {reservation.notes && (
          <>
            <dt className="text-muted">Notes</dt>
            <dd className="m-0 whitespace-pre-line">{reservation.notes}</dd>
          </>
        )}
        <dt className="text-muted">Invoice</dt>
        <dd className="m-0">
          {reservation.invoice.number} · {formatPrice(reservation.invoice.amountCents)} ·{' '}
          {INVOICE_STATUS[reservation.invoice.status]}
        </dd>
      </dl>
    </Card>
  );
}

/**
 * "Pay now" with the countdown, and "Cancel booking" (FSD 2.1 Payment pending, 6.7), shown
 * only when the API allows them.
 */
export function PaymentActions({ reservation }: Readonly<{ reservation: Reservation }>) {
  const resume = useResumePayment(reservation.id);
  const cancel = useCancelReservation(reservation.id);
  const countdown = useCountdown(reservation.payBy);
  const [confirming, setConfirming] = useState(false);
  const { pay, cancel: canCancel } = reservation.actions;
  if (!pay && !canCancel) return null;

  const payNow = () =>
    resume.mutate(undefined, { onSuccess: (url) => window.location.assign(url) });
  const error = toRequestErrorView(resume.error ?? cancel.error, {
    HOLD_EXPIRED: 'The time to pay has run out, so the slot was released.',
  });

  return (
    <Card className="flex flex-col gap-4 p-5">
      {pay && !countdown.expired && (
        <p className="m-0 flex items-center gap-2 font-semibold" aria-live="polite">
          <Icon name="clock" size={18} />
          Your time is held. Pay within{' '}
          <span className="font-extrabold tabular-nums">{countdown.label}</span>
        </p>
      )}
      {countdown.expired && (
        <Alert tone="info">The time to pay has run out. Reload to see the latest status.</Alert>
      )}
      <RequestErrorAlert error={error} />
      <div className="flex flex-wrap gap-3">
        {pay && (
          <Button size="lg" onClick={payNow} disabled={resume.isPending || countdown.expired}>
            {resume.isPending ? 'Opening payment…' : 'Pay now'}
          </Button>
        )}
        {canCancel && (
          <Button variant="secondary" size="lg" onClick={() => setConfirming(true)}>
            Cancel booking
          </Button>
        )}
      </div>
      <ConfirmDialog
        open={confirming}
        title="Cancel this booking?"
        confirmLabel="Cancel booking"
        destructive
        busy={cancel.isPending}
        onConfirm={() => cancel.mutate(undefined, { onSettled: () => setConfirming(false) })}
        onCancel={() => setConfirming(false)}
      >
        The time is released straight away and nothing is charged.
      </ConfirmDialog>
    </Card>
  );
}

/** A booking's page: summary, then what can still be done. */
export function ReservationDetail({
  reservation,
  title,
  notice,
}: Readonly<{ reservation: Reservation; title: string; notice?: string | undefined }>) {
  return (
    <ReservationPage>
      <h1 className="text-[32px] leading-tight font-extrabold">{title}</h1>
      {notice && <Alert tone="success">{notice}</Alert>}
      {reservation.status === 'cancelled' && (
        <Alert tone="info">This booking was cancelled. Nothing was charged.</Alert>
      )}
      {reservation.status === 'expired' && (
        <Alert tone="info">
          This booking expired because it was not paid in time. Nothing was charged.
        </Alert>
      )}
      <ReservationSummaryCard reservation={reservation} />
      <PaymentActions reservation={reservation} />
      <ChangeAndInvoice reservation={reservation} />
      {(reservation.status === 'cancelled' || reservation.status === 'expired') && (
        <Link
          href={`/${reservation.business.slug}/book`}
          className="font-semibold text-primary-text"
        >
          Book another time at {reservation.business.name}
        </Link>
      )}
    </ReservationPage>
  );
}

/** "Reschedule" (or why not, FSD 6.5) and the invoice link. */
function ChangeAndInvoice({ reservation }: Readonly<{ reservation: Reservation }>) {
  const notice = rescheduleNotice(reservation);
  return (
    <div className="flex flex-col gap-3">
      {notice && (
        <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
          <span className="text-sm text-muted">{notice.message}</span>
          {notice.allowed && (
            <Link
              href={`/bookings/${reservation.id}/reschedule`}
              className={buttonVariants({ variant: 'secondary' })}
            >
              Reschedule
            </Link>
          )}
        </Card>
      )}
      <Link
        href={`/bookings/${reservation.id}/invoice`}
        className="font-semibold text-primary-text"
      >
        View invoice {reservation.invoice.number}
      </Link>
    </div>
  );
}
