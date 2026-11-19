// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import { Alert, Button, Card, Icon, TextField } from '@tempora/ui';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useState, type SubmitEvent } from 'react';
import { useCustomer } from '@/core/account/presentation/use-account';
import { useBranchPage, useBusinessPage } from '@/core/booking/presentation/use-booking';
import { useReserve } from '@/core/reservation/presentation/use-reservation';
import { toRequestErrorView } from '@/core/shared/presentation/error-view';
import { NotFoundPanel, PageShell } from '@/ui/business/page-shell';
import { formText } from '@/ui/common/form-values';
import { RequestErrorAlert } from '@/ui/common/request-error';
import { BookingSteps } from './booking-steps';

const SLOT_GONE = new Set([
  'SLOT_TAKEN',
  'TOO_SOON',
  'OFF_GRID',
  'OUTSIDE_OPENING_HOURS',
  'OUTSIDE_WORKING_HOURS',
  'BRANCH_CLOSED',
  'THERAPIST_TIME_OFF',
]);

/**
 * FSD 2.1 `/[tenant]/book/details`, step 3: log in or continue as a guest, notes, summary,
 * then the payment page (Stripe Checkout, or the demo checkout without Stripe keys).
 */
export function DetailsScreen({ slug }: Readonly<{ slug: string }>) {
  const pathname = usePathname();
  const params = useSearchParams();
  const branchId = params.get('branch') ?? undefined;
  const serviceId = params.get('service');
  const staffId = params.get('staff');
  const time = params.get('time');
  const business = useBusinessPage(slug);
  const branch = useBranchPage(slug, branchId);
  const customer = useCustomer();
  const reserve = useReserve();
  // One key per visit of this page: a double click or a retry cannot book twice (FSD 5.1).
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  if (business.isPending || branch.isPending || customer.isPending) return <PageShell loading />;
  if (business.isError || branch.isError || !business.data.available) return <NotFoundPanel />;
  const service = branch.data.services.find((s) => s.id === serviceId);
  const therapist = branch.data.therapists.find((t) => t.id === staffId);
  const startsAt = time ? new Date(time) : null;
  if (!service || !therapist || !startsAt || Number.isNaN(startsAt.getTime())) {
    return <NotFoundPanel />;
  }

  const here = `${pathname}?${params}`;
  const backToTime = `/${slug}/book/time?${new URLSearchParams({
    branch: branchId!,
    service: serviceId!,
    staff: staffId!,
    date: params.get('date') ?? '',
  })}`;
  const timeZone = business.data.timeZone;
  const when = `${new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone,
  }).format(startsAt)}, ${new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  }).format(startsAt)}`;

  const error = toRequestErrorView(reserve.error, {
    SLOT_TAKEN: 'This time was just taken. Please choose another one.',
  });
  const slotGone = !!error && SLOT_GONE.has(error.code);
  const signedIn = customer.data;

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const notes = formText(form, 'notes');
    const phone = formText(form, 'phone');
    reserve.mutate(
      {
        idempotencyKey,
        input: {
          tenantSlug: slug,
          branchId: branchId!,
          serviceId: service.id,
          staffId: therapist.id,
          startsAt,
          ...(notes && { notes }),
          ...(!signedIn && {
            guest: {
              name: formText(form, 'name'),
              email: formText(form, 'email'),
              ...(phone && { phone }),
            },
          }),
        },
      },
      { onSuccess: (created) => window.location.assign(created.checkoutUrl) },
    );
  };

  return (
    <PageShell>
      <BookingSteps businessName={business.data.name} slug={slug} current={2} />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <form onSubmit={submit} className="flex flex-col gap-5" noValidate={false}>
          {signedIn ? (
            <Card className="flex flex-col gap-1 p-5">
              <span className="text-sm text-muted">Booking as</span>
              <span className="font-extrabold">
                {signedIn.name} · {signedIn.email}
              </span>
              {!signedIn.emailVerified && (
                <span className="text-sm text-muted">
                  Verify your email to see this booking under My bookings later.
                </span>
              )}
            </Card>
          ) : (
            <Card className="flex flex-col gap-4 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-extrabold">Your details</h2>
                <span className="text-sm">
                  <Link
                    href={`/login?next=${encodeURIComponent(here)}`}
                    className="font-semibold text-primary-text"
                  >
                    Log in
                  </Link>{' '}
                  or{' '}
                  <Link
                    href={`/signup?next=${encodeURIComponent(here)}`}
                    className="font-semibold text-primary-text"
                  >
                    create an account
                  </Link>
                </span>
              </div>
              <p className="text-sm text-muted">
                Or continue as a guest: we email you a link to manage this booking.
              </p>
              <TextField
                label="Name"
                name="name"
                required
                maxLength={100}
                autoComplete="name"
                error={error?.fields['guest.name']}
              />
              <TextField
                label="Email"
                name="email"
                type="email"
                required
                autoComplete="email"
                error={error?.fields['guest.email']}
              />
              <TextField
                label="Phone (optional)"
                name="phone"
                type="tel"
                autoComplete="tel"
                hint="International format, e.g. +1 555 0147"
                error={error?.fields['guest.phone']}
              />
            </Card>
          )}

          <Card className="flex flex-col gap-2 p-5">
            <label htmlFor="notes" className="font-semibold">
              Notes for the therapist (optional)
            </label>
            <textarea
              id="notes"
              name="notes"
              maxLength={500}
              rows={3}
              className="rounded-xl border-2 border-border bg-surface px-3 py-2.5"
            />
          </Card>

          {error && !slotGone && <RequestErrorAlert error={error} />}
          {slotGone && (
            <Alert tone="danger">
              {error.message}{' '}
              <Link href={backToTime} className="font-semibold underline">
                Choose another time
              </Link>
            </Alert>
          )}
          <Button type="submit" size="lg" className="self-start" disabled={reserve.isPending}>
            {reserve.isPending ? 'Holding your time…' : 'Continue to payment'}
            <Icon name="arrow-right" size={18} />
          </Button>
        </form>

        <Card className="flex h-fit flex-col gap-3 p-5" aria-label="Summary">
          <h2 className="text-lg font-extrabold">Summary</h2>
          <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted">Service</dt>
            <dd className="m-0 font-semibold">{service.name}</dd>
            <dt className="text-muted">When</dt>
            <dd className="m-0 font-semibold">
              {when} <span className="font-normal text-muted">({timeZone})</span>
            </dd>
            <dt className="text-muted">Duration</dt>
            <dd className="m-0">{service.duration}</dd>
            <dt className="text-muted">Therapist</dt>
            <dd className="m-0">{therapist.displayName}</dd>
            <dt className="text-muted">Branch</dt>
            <dd className="m-0">{branch.data.name}</dd>
            <dt className="text-muted">Price</dt>
            <dd className="m-0 text-base font-extrabold">{service.price}</dd>
          </dl>
          <p className="text-xs text-muted">
            The time is held for 30 minutes while you pay.{' '}
            <Link href={backToTime} className="font-semibold text-primary-text">
              Change time
            </Link>
          </p>
        </Card>
      </div>
    </PageShell>
  );
}
