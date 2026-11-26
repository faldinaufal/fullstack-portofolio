// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import { Badge, buttonVariants, Icon, TherapistPhoto, type IconName } from '@tempora/ui';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { useCustomer } from '@/core/account/presentation/use-account';
import { formatPrice } from '@/core/booking/presentation/use-booking';
import type { Reservation } from '@/core/reservation/presentation/use-reservation';

const SHADOW = 'shadow-[0_1px_3px_rgba(31,28,27,0.06)]';

/**
 * FSD 2.1 `/bookings/[id]/confirmation` once the webhook has confirmed the payment, laid out
 * like Figma `1:2052` (DESIGN 5.1). Figma content outside the FSD is replaced (DESIGN 4.2):
 * the booking reference becomes the invoice number, "Download PDF" becomes the printable
 * invoice, there is no tax line, no "Add to calendar" and no full therapist name.
 */
export function ConfirmedView({ reservation }: Readonly<{ reservation: Reservation }>) {
  const customer = useCustomer().data;
  const { timeZone, invoice } = reservation;
  const minutes = Math.round(
    (reservation.endsAt.getTime() - reservation.startsAt.getTime()) / 60_000,
  );
  const day = new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone,
  }).format(reservation.startsAt);
  const time = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone });
  const until =
    reservation.actions.reschedule && reservation.rescheduling
      ? new Intl.DateTimeFormat('en-GB', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
          timeZone,
        }).format(reservation.rescheduling.until)
      : null;
  const firstName = customer?.name.split(' ')[0];

  return (
    <main className="relative overflow-hidden px-4 py-12 sm:px-6 sm:py-16">
      {/* A soft glow behind the heading, in the success colour (no teal, DESIGN 3). */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(ellipse_at_top,var(--success-soft),transparent_65%)]"
      />
      <div className="relative mx-auto flex max-w-[720px] flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-5 text-center">
          <p className="flex items-center gap-2 rounded-full bg-surface-muted px-4 py-1.5 text-xs font-semibold">
            <span aria-hidden="true" className="size-2 rounded-full bg-success" />
            <span className="tracking-wider text-success uppercase">Payment confirmed</span>
            <span aria-hidden="true" className="text-muted">
              ·
            </span>
            <span>Instant confirmation</span>
          </p>
          {/* Two layers as in Figma: a soft oval halo and a raised inner oval with the check. */}
          <span
            aria-hidden="true"
            className="flex h-[88px] w-[112px] items-center justify-center rounded-full border border-success-container bg-success-soft"
          >
            <span className="flex h-16 w-20 items-center justify-center rounded-full bg-success-container text-success shadow-[0_6px_16px_rgba(4,120,87,0.18)]">
              <Icon name="check" size={30} strokeWidth={2.5} />
            </span>
          </span>
          <h1 className="text-[34px] leading-tight font-semibold tracking-tight sm:text-[44px]">
            You’re all booked{firstName ? `, ${firstName}` : ''}!
          </h1>
          <p className="max-w-[520px] text-muted sm:text-lg">
            A confirmation email with your invoice has been sent
            {customer ? (
              <>
                {' '}
                to <span className="font-medium text-foreground">{customer.email}</span>
              </>
            ) : (
              ' to the address you gave'
            )}
            .
          </p>
        </div>

        <section
          aria-label="Booking"
          className={`flex w-full flex-col gap-5 rounded-panel border border-border-subtle bg-surface p-5 sm:p-8 ${SHADOW}`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-4">
              <span
                aria-hidden="true"
                className="flex size-12 items-center justify-center rounded-card bg-primary-container text-on-primary-container"
              >
                <Icon name="receipt" size={22} />
              </span>
              <div>
                <p className="text-xs font-semibold tracking-wider uppercase">Invoice number</p>
                <p className="text-xl font-medium">{invoice.number}</p>
              </div>
            </div>
            <Badge tone="success" dot>
              Confirmed &amp; paid
            </Badge>
          </div>

          <div className="flex flex-col gap-4 rounded-card bg-surface-muted p-4 sm:flex-row sm:items-center sm:p-5">
            <TherapistPhoto
              name={reservation.therapist}
              url={reservation.therapistPhotoUrl}
              className="size-14 rounded-full text-base"
            />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <p className="text-xs font-semibold tracking-wider uppercase">
                Therapist &amp; business
              </p>
              <p className="text-xl font-medium">{reservation.therapist}</p>
              <p className="flex items-start gap-1.5 text-sm text-muted">
                <Icon name="map-pin" size={16} className="mt-0.5 shrink-0" />
                <span>
                  {reservation.business.name} ({reservation.branchName} branch
                  {reservation.branchAddress && `, ${reservation.branchAddress}`})
                </span>
              </p>
            </div>
            <Link
              href={`/${reservation.business.slug}`}
              className={buttonVariants({
                variant: 'secondary',
                size: 'sm',
                className: 'self-start border-transparent sm:self-center',
              })}
            >
              Business page
            </Link>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Tile icon="calendar" label="Scheduled time">
              <p className="text-lg font-medium">{day}</p>
              <p>
                {time.format(reservation.startsAt)} – {time.format(reservation.endsAt)} ({minutes}{' '}
                min)
              </p>
              <p className="text-sm text-muted">{timeZone.replace(/_/g, ' ')} time</p>
            </Tile>
            <Tile icon="massage" label="Service">
              <p className="text-lg font-medium">{reservation.serviceName}</p>
              {reservation.notes ? (
                <p className="line-clamp-2 text-muted">Your note: {reservation.notes}</p>
              ) : (
                <p className="text-muted">{minutes} min session</p>
              )}
            </Tile>
          </div>

          <div className="flex flex-col gap-4 rounded-card border border-border-subtle p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold tracking-wider uppercase">Payment summary</p>
              <p className="flex items-center gap-1.5 text-xs font-semibold text-success">
                <Icon name="shield-check" size={14} /> Paid online
              </p>
            </div>
            <div className="flex justify-between gap-4 text-sm text-muted">
              <span>
                {reservation.serviceName} ({minutes} min session)
              </span>
              <span className="tabular-nums">{formatPrice(invoice.amountCents)}</span>
            </div>
            <div className="flex items-end justify-between gap-4 border-t border-border-subtle pt-4">
              <div>
                <p className="text-xl font-medium">Total paid</p>
                <p className="text-xs font-semibold">Invoice {invoice.number}</p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-semibold tabular-nums sm:text-4xl">
                  {formatPrice(invoice.amountCents)}
                </p>
                <p className="text-xs font-semibold">USD</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
            <Link
              href={`/bookings/${reservation.id}/invoice`}
              className={buttonVariants({
                variant: 'ghost',
                className: 'bg-surface-muted hover:bg-surface-sunken',
              })}
            >
              <Icon name="receipt" size={18} /> View invoice
            </Link>
            <Link
              href={customer ? '/account/bookings' : `/bookings/${reservation.id}`}
              className={buttonVariants({ size: 'lg' })}
            >
              {customer ? 'View in My bookings' : 'Manage this booking'}
              <Icon name="arrow-right" size={18} />
            </Link>
          </div>
        </section>

        {until && (
          <p
            className={`flex items-center gap-2 rounded-full border border-border-subtle bg-surface px-5 py-3 text-sm ${SHADOW}`}
          >
            <Icon name="calendar-edit" size={18} className="shrink-0 text-primary-text" />
            <span>
              Need to change plans? You can reschedule online until{' '}
              <span className="font-semibold">{until}</span>.
            </span>
          </p>
        )}
      </div>
    </main>
  );
}

function Tile({
  icon,
  label,
  children,
}: Readonly<{ icon: IconName; label: string; children: ReactNode }>) {
  return (
    <div className="flex flex-col gap-1.5 rounded-card bg-surface-muted p-4 sm:p-5">
      <p className="mb-1 flex items-center gap-2 text-xs font-semibold tracking-wider uppercase">
        <Icon name={icon} size={16} className="text-primary-text" /> {label}
      </p>
      {children}
    </div>
  );
}
