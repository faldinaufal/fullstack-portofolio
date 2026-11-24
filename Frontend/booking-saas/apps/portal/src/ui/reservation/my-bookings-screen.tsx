// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import {
  Alert,
  Badge,
  Button,
  buttonVariants,
  ConfirmDialog,
  Icon,
  TherapistPhoto,
} from '@tempora/ui';
import Link from 'next/link';
import { useRef, useState, type KeyboardEvent } from 'react';
import {
  useCancelReservation,
  useMyReservations,
  useResumePayment,
  type ReservationView,
} from '@/core/reservation/presentation/use-reservation';
import { toRequestErrorView } from '@/core/shared/presentation/error-view';
import { RequestErrorAlert } from '@/ui/common/request-error';
import { AccountPage, useRequireCustomer } from './account-page';

type When = 'upcoming' | 'past';
const TABS: { value: When; label: string }[] = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'past', label: 'Past' },
];

/** Buttons of the booking card: a little larger than the default, as in the design. */
const ACTION = 'min-h-11 px-6 text-[15px]';
/** The muted "Cancel" of the design: a filled neutral button without a border. */
const MUTED_BUTTON = buttonVariants({
  variant: 'ghost',
  className: `${ACTION} bg-surface-muted hover:bg-border-subtle`,
});
const PRIMARY_BUTTON = buttonVariants({ className: ACTION });

/**
 * FSD 2.1 `/account/bookings` (DESIGN 5.1, Figma `1:1633`): upcoming and past bookings at
 * every business. Each card shows the invoice number (there is no booking number), the
 * therapist's initials (there are no staff photos) and only the actions the API allows:
 * pay and cancel while unpaid, reschedule when allowed.
 */
export function MyBookingsScreen() {
  const customer = useRequireCustomer('/account/bookings');
  const [when, setWhen] = useState<When>('upcoming');
  const [page, setPage] = useState(1);
  const list = useMyReservations(when, page);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  const select = (value: When) => {
    setWhen(value);
    setPage(1);
  };
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const next = when === 'upcoming' ? 1 : 0;
    select(TABS[next]!.value);
    tabs.current[next]?.focus();
  }

  const pages = list.data ? Math.max(1, Math.ceil(list.data.total / list.data.pageSize)) : 1;
  const counts = list.data?.counts;

  const tablist = (
    <div
      role="tablist"
      aria-label="Bookings"
      onKeyDown={onKeyDown}
      className="inline-flex gap-1 rounded-xl bg-surface-muted p-1"
    >
      {TABS.map((tab, index) => {
        const active = when === tab.value;
        return (
          <button
            key={tab.value}
            ref={(el) => {
              tabs.current[index] = el;
            }}
            type="button"
            role="tab"
            id={`bookings-tab-${tab.value}`}
            aria-selected={active}
            aria-controls="bookings-panel"
            tabIndex={active ? 0 : -1}
            onClick={() => select(tab.value)}
            className={`min-h-10 rounded-lg px-5 text-sm font-semibold transition-colors ${
              active
                ? 'bg-surface text-primary-text shadow-[0_1px_3px_rgba(31,28,27,0.12)]'
                : 'text-muted hover:text-foreground'
            }`}
          >
            {tab.label}
            {counts && ` (${counts[tab.value]})`}
          </button>
        );
      })}
    </div>
  );

  return (
    <AccountPage
      customer={customer}
      narrow
      title="My bookings"
      description="Your sessions at every business on Tempora, in the business’s local time."
      aside={customer && tablist}
    >
      {customer && !customer.emailVerified && (
        <Alert tone="info">
          Verify your email to see bookings you made before logging in.{' '}
          <Link href="/account/profile" className="font-semibold underline">
            Profile
          </Link>
        </Alert>
      )}

      <div
        role="tabpanel"
        id="bookings-panel"
        aria-labelledby={`bookings-tab-${when}`}
        className="flex flex-col gap-4"
      >
        {list.isPending && (
          <div role="status" aria-label="Loading" className="flex flex-col gap-4">
            <div className="h-32 animate-pulse rounded-panel bg-surface-muted" />
            <div className="h-32 animate-pulse rounded-panel bg-surface-muted" />
          </div>
        )}
        {list.isError && <Alert tone="danger">Your bookings could not be loaded.</Alert>}
        {list.data?.items.length === 0 && (
          <div className="flex flex-col items-start gap-3 rounded-panel border border-dashed border-border bg-surface p-8">
            <p className="m-0 text-lg font-semibold">
              {when === 'upcoming' ? 'No upcoming bookings.' : 'No past bookings yet.'}
            </p>
            <Link href="/#businesses" className={buttonVariants()}>
              Find a business
            </Link>
          </div>
        )}
        {list.data && list.data.items.length > 0 && (
          <ul className="m-0 flex list-none flex-col gap-4 p-0">
            {list.data.items.map((item) => (
              <li key={item.id}>
                <BookingCard item={item} upcoming={when === 'upcoming'} />
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
      </div>
    </AccountPage>
  );
}

/** "Fri, 25 Oct · 14:00" in the business's time zone; the year only when it is not this year. */
function startLabel(item: ReservationView) {
  const sameYear = item.startsAt.getFullYear() === new Date().getFullYear();
  const day = new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
    timeZone: item.timeZone,
  }).format(item.startsAt);
  const time = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: item.timeZone,
  }).format(item.startsAt);
  return `${day} · ${time}`;
}

function BookingCard({ item, upcoming }: Readonly<{ item: ReservationView; upcoming: boolean }>) {
  const resume = useResumePayment(item.id);
  const cancel = useCancelReservation(item.id);
  const [confirming, setConfirming] = useState(false);
  const { pay, cancel: canCancel, reschedule } = item.actions;
  const error = toRequestErrorView(resume.error ?? cancel.error, {
    HOLD_EXPIRED: 'The time to pay has run out, so the slot was released.',
  });
  const minutes = Math.round((item.endsAt.getTime() - item.startsAt.getTime()) / 60_000);
  const details = `/account/bookings/${item.id}`;

  return (
    <article
      aria-labelledby={`booking-${item.id}`}
      className="flex flex-col gap-4 rounded-panel border border-border-subtle bg-surface p-5 shadow-[0_1px_3px_rgba(31,28,27,0.06)] sm:px-7 sm:py-6"
    >
      <div className="flex flex-col gap-5 md:flex-row md:items-center md:gap-6">
        <div className="flex min-w-0 flex-1 gap-4 sm:gap-5">
          <TherapistPhoto
            name={item.therapist}
            url={item.therapistPhotoUrl}
            className="size-16 text-xl sm:size-[72px]"
          />

          <div className="flex min-w-0 flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <Badge tone={item.statusTone}>{item.statusLabel}</Badge>
              <span className="text-sm font-bold tracking-wide text-muted">
                <span className="sr-only">Invoice </span>
                {item.invoiceNumber}
              </span>
            </div>
            <h2
              id={`booking-${item.id}`}
              className="text-xl font-semibold tracking-tight sm:text-2xl"
            >
              <Link href={details} className="hover:underline">
                {item.serviceName}
              </Link>
              <span> · {minutes} min</span>
            </h2>
            <ul className="m-0 flex list-none flex-wrap items-center gap-x-3 gap-y-1 p-0 text-sm sm:text-base">
              <li
                className={`flex items-center gap-1.5 font-medium ${
                  upcoming ? 'text-primary-text' : 'text-muted'
                }`}
              >
                <Icon name="clock" size={16} />
                <span className="sr-only">Starts </span>
                {startLabel(item)}
              </li>
              <Dot />
              <li className="text-muted">
                <span className="sr-only">Therapist </span>
                {item.therapist}
              </li>
              {/* Small screens put the business on its own line, so no separator there. */}
              <Dot className="max-sm:hidden" />
              <li className="text-muted max-sm:basis-full">
                {item.business.name} · {item.branchName}
              </li>
            </ul>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 md:shrink-0 md:justify-end">
          {pay && (
            <Button
              className={ACTION}
              disabled={resume.isPending}
              onClick={() =>
                resume.mutate(undefined, { onSuccess: (url) => window.location.assign(url) })
              }
            >
              {resume.isPending ? 'Opening payment…' : 'Pay now'}
            </Button>
          )}
          {reschedule && (
            <Link
              href={`/bookings/${item.id}/reschedule`}
              className={pay ? MUTED_BUTTON : PRIMARY_BUTTON}
            >
              Reschedule
            </Link>
          )}
          {canCancel && (
            <Button variant="ghost" className={MUTED_BUTTON} onClick={() => setConfirming(true)}>
              Cancel
            </Button>
          )}
          {!pay && !reschedule && !canCancel && (
            <Link href={details} className={MUTED_BUTTON}>
              View details
            </Link>
          )}
        </div>
      </div>

      <RequestErrorAlert error={error} />

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
    </article>
  );
}

function Dot({ className = '' }: Readonly<{ className?: string }>) {
  return (
    <li aria-hidden="true" className={`size-1 rounded-full bg-muted opacity-60 ${className}`} />
  );
}
