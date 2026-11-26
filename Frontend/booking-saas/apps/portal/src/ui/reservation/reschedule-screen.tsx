// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import { Alert, Badge, Button, Icon, TherapistPhoto, type IconName } from '@tempora/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import {
  formatPrice,
  toBookableDays,
  useBranchPage,
  useBusinessPage,
} from '@/core/booking/presentation/use-booking';
import {
  rescheduleNotice,
  useReschedule,
  useRescheduleSlots,
  useReservation,
  type Reservation,
} from '@/core/reservation/presentation/use-reservation';
import { toRequestErrorView } from '@/core/shared/presentation/error-view';
import { RequestErrorAlert } from '@/ui/common/request-error';
import { ReservationLoading, ReservationPage, ReservationUnavailable } from './reservation-parts';

const SHADOW = 'shadow-[0_1px_3px_rgba(31,28,27,0.06)]';

/**
 * FSD 2.1 `/bookings/[id]/reschedule`, rule 6.5: same branch and service; the therapist may
 * change to another one of the branch who performs the service. Customers and guests.
 * Laid out like Figma `1:2257` (DESIGN 5.1) without "Any available specialist", the booking
 * reference or the room (DESIGN 4.1, 4.2).
 */
export function RescheduleScreen({ id }: Readonly<{ id: string }>) {
  const reservation = useReservation(id);
  if (reservation.isPending) return <ReservationLoading />;
  if (reservation.isError) return <ReservationUnavailable />;
  const notice = rescheduleNotice(reservation.data);
  if (!notice?.allowed) {
    return (
      <ReservationPage>
        <h1 className="text-[32px] leading-tight font-semibold tracking-tight">Reschedule</h1>
        <Alert tone="info">{notice?.message ?? 'Only confirmed bookings can be moved.'}</Alert>
        <Link href={`/bookings/${id}`} className="font-semibold text-primary-text">
          Back to the booking
        </Link>
      </ReservationPage>
    );
  }
  return <RescheduleForm reservation={reservation.data} />;
}

/** Morning, afternoon and evening groups of the free times, as in the design. */
const PERIODS: { label: string; icon: IconName; from: number; to: number }[] = [
  { label: 'Morning', icon: 'sunrise', from: 0, to: 12 },
  { label: 'Afternoon', icon: 'sun', from: 12, to: 17 },
  { label: 'Evening', icon: 'moon', from: 17, to: 24 },
];

/** The choices, once the booking is known: its branch's therapists, days and free times. */
function RescheduleForm({ reservation: data }: Readonly<{ reservation: Reservation }>) {
  const id = data.id;
  const router = useRouter();
  const business = useBusinessPage(data.business.slug);
  const branch = useBranchPage(data.business.slug, data.branchId);
  const [staffId, setStaffId] = useState(data.staffId);
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const reschedule = useReschedule(id);

  const days = toBookableDays(branch.data, business.data);
  const day = date ?? days.find((d) => d.open)?.date ?? null;
  const slots = useRescheduleSlots(
    id,
    day ? { date: day, staffId } : null,
    business.data?.timeZone,
  );

  if (business.isPending || branch.isPending) return <ReservationLoading />;
  if (business.isError || branch.isError) return <ReservationUnavailable />;

  const { timeZone } = data;
  const back = `/bookings/${id}`;
  const minutes = Math.round((data.endsAt.getTime() - data.startsAt.getTime()) / 60_000);
  const remaining = data.rescheduling?.remaining ?? 0;
  const allowed = business.data.policy.maxCustomerReschedules;
  const therapists = branch.data.therapistsFor(data.serviceId);
  const therapist = therapists.find((t) => t.id === staffId);
  const chosen = slots.data?.find((slot) => slot.key === time);
  const error = toRequestErrorView(reschedule.error, {
    SLOT_TAKEN: 'This time was just taken. Please choose another one.',
  });
  const confirm = () =>
    chosen &&
    reschedule.mutate(
      { startsAt: chosen.startsAt, staffId },
      { onSuccess: () => router.push(`${back}?rescheduled=1`) },
    );

  const format = (options: Intl.DateTimeFormatOptions, at: Date) =>
    new Intl.DateTimeFormat('en-GB', { ...options, timeZone }).format(at);
  const clock = (at: Date) => format({ hour: '2-digit', minute: '2-digit' }, at);
  const dayOf = (iso: string, options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('en-GB', { ...options, timeZone: 'UTC' }).format(
      new Date(`${iso}T12:00:00Z`),
    );
  const months =
    days.length > 0
      ? [
          ...new Set(
            [days[0]!, days.at(-1)!].map((d) => dayOf(d.date, { month: 'long', year: 'numeric' })),
          ),
        ].join(' – ')
      : '';

  return (
    <main className="px-4 py-10 sm:px-6 sm:py-14">
      <div className="mx-auto flex max-w-250 flex-col gap-10">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <Link
              href={back}
              aria-label="Back to the booking"
              className="mt-1 flex size-11 shrink-0 items-center justify-center rounded-full bg-surface-muted text-muted transition-colors hover:bg-surface-sunken hover:text-foreground"
            >
              <Icon name="arrow-right" size={20} className="rotate-180" />
            </Link>
            <div>
              <p className="text-sm font-semibold tracking-wider text-primary-text uppercase">
                Reschedule booking
              </p>
              <h1 className="text-[30px] leading-tight font-semibold tracking-tight sm:text-[38px]">
                Choose a new time
              </h1>
            </div>
          </div>
          {data.rescheduling && (
            <p className="flex items-center gap-2 rounded-full bg-surface-muted px-4 py-1.5 text-sm font-medium">
              <span aria-hidden="true" className="size-2 rounded-full bg-success" />
              Change online until{' '}
              {format(
                {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                },
                data.rescheduling.until,
              )}
            </p>
          )}
        </header>

        <section
          aria-label="Current booking"
          className={`relative flex flex-col gap-5 overflow-hidden rounded-panel border border-border-subtle bg-surface p-5 pl-7 sm:flex-row sm:items-center sm:justify-between sm:p-8 sm:pl-10 ${SHADOW}`}
        >
          <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1.5 bg-primary" />
          <div className="flex min-w-0 flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2.5 text-sm">
              <span className="font-semibold tracking-wide text-muted uppercase">
                <span className="sr-only">Invoice </span>
                {data.invoice.number}
              </span>
              <span aria-hidden="true" className="size-1 rounded-full bg-border" />
              <Badge tone="success" dot>
                Confirmed
              </Badge>
              <span className="flex items-center gap-1.5 rounded-full bg-surface-muted px-3 py-1 font-medium">
                <Icon name="check-circle" size={15} className="text-success" />
                {remaining} of {allowed} free reschedules remaining
              </span>
            </div>
            <h2 className="text-[28px] leading-tight font-semibold tracking-tight sm:text-[40px]">
              {data.serviceName}
            </h2>
            <ul className="m-0 flex list-none flex-wrap gap-x-6 gap-y-2 p-0 text-muted">
              <li className="flex items-center gap-2">
                <Icon name="calendar" size={18} className="text-primary-text" />
                <span className="text-foreground">
                  <span className="sr-only">Now </span>
                  {format(
                    { weekday: 'long', day: 'numeric', month: 'short' },
                    data.startsAt,
                  )} · {clock(data.startsAt)}
                </span>
                ({minutes} min)
              </li>
              <li className="flex items-center gap-2">
                <Icon name="user" size={18} className="text-primary-text" />
                {data.therapist}
              </li>
              <li className="flex items-center gap-2">
                <Icon name="map-pin" size={18} className="text-primary-text" />
                {data.branchName}
                {data.branchAddress && `, ${data.branchAddress}`}
              </li>
            </ul>
          </div>
          <div className="shrink-0 sm:text-right">
            <p className="text-sm font-medium tracking-wider text-muted uppercase">Session price</p>
            <p className="text-3xl font-semibold tabular-nums">
              {formatPrice(data.invoice.amountCents)}
            </p>
            {data.invoice.status === 'paid' && (
              <p className="text-sm font-semibold text-success">Paid</p>
            )}
          </div>
        </section>

        <Step number={1} title="Therapist" note="Same branch and service">
          <fieldset className="m-0 grid gap-4 border-0 p-0 sm:grid-cols-2">
            <legend className="sr-only">Therapist</legend>
            {therapists.map((t) => {
              const checked = t.id === staffId;
              return (
                <label
                  key={t.id}
                  className={`flex cursor-pointer items-center gap-4 rounded-card border-2 bg-surface p-4 transition-colors has-focus-visible:ring-2 has-focus-visible:ring-ring ${
                    checked ? 'border-primary' : `border-transparent hover:border-border ${SHADOW}`
                  }`}
                >
                  <input
                    type="radio"
                    name="staff"
                    className="sr-only"
                    checked={checked}
                    onChange={() => {
                      setStaffId(t.id);
                      setTime(null);
                    }}
                  />
                  <TherapistPhoto
                    name={t.displayName}
                    url={t.photoUrl}
                    className="size-14 rounded-full text-base"
                  />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-xl font-medium">{t.displayName}</span>
                    <span className="text-sm text-muted">
                      {t.id === data.staffId
                        ? 'Your current therapist'
                        : `Performs ${data.serviceName}`}
                    </span>
                  </span>
                  {checked ? (
                    <span
                      aria-hidden="true"
                      className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
                    >
                      <Icon name="check" size={15} strokeWidth={2.5} />
                    </span>
                  ) : (
                    <span
                      aria-hidden="true"
                      className="size-7 shrink-0 rounded-full bg-surface-sunken"
                    />
                  )}
                </label>
              );
            })}
          </fieldset>
        </Step>

        <Step number={2} title="Date" note={months}>
          <div
            role="listbox"
            aria-label="Day"
            className="-mx-1 flex gap-3 overflow-x-auto px-1 pt-1 pb-2"
          >
            {days.map((d) => {
              const selected = d.date === day;
              return (
                <button
                  key={d.date}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  disabled={!d.open}
                  onClick={() => {
                    setDate(d.date);
                    setTime(null);
                  }}
                  className={`flex min-w-24 shrink-0 flex-col items-center gap-1 rounded-card px-4 py-4 transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                    selected
                      ? 'bg-primary text-primary-foreground shadow-[0_6px_16px_rgba(223,90,73,0.25)]'
                      : `bg-surface hover:bg-surface-muted ${SHADOW}`
                  }`}
                >
                  <span className={`text-sm font-medium uppercase ${selected ? '' : 'text-muted'}`}>
                    {dayOf(d.date, { weekday: 'short' })}
                  </span>
                  <span className="text-3xl font-medium tabular-nums">
                    {dayOf(d.date, { day: 'numeric' })}
                  </span>
                  <span className="text-[11px]">
                    {d.open ? dayOf(d.date, { month: 'short' }) : 'Closed'}
                  </span>
                </button>
              );
            })}
          </div>
        </Step>

        <Step number={3} title="Available start times" note={`${minutes}-minute session`}>
          <div
            className={`flex flex-col gap-6 rounded-panel border border-border-subtle bg-surface p-5 sm:p-8 ${SHADOW}`}
          >
            <p className="text-sm text-muted">Times in {timeZone.replace(/_/g, ' ')}</p>
            {slots.isPending && (
              <div className="h-24 animate-pulse rounded-card bg-surface-muted" />
            )}
            {slots.isError && <Alert tone="danger">Free times could not be loaded.</Alert>}
            {slots.data?.length === 0 && (
              <p className="text-muted">No free times on this day. Try another day.</p>
            )}
            {slots.data &&
              PERIODS.map((period) => {
                const inPeriod = slots.data.filter((slot) => {
                  const hour = Number(slot.label.slice(0, 2));
                  return hour >= period.from && hour < period.to;
                });
                if (inPeriod.length === 0) return null;
                return (
                  <div
                    key={period.label}
                    className="flex flex-col gap-4 border-border-subtle not-first-of-type:border-t not-first-of-type:pt-6"
                  >
                    <p className="flex items-center gap-2 text-sm font-medium tracking-wider text-muted uppercase">
                      <Icon name={period.icon} size={18} /> {period.label}
                    </p>
                    <div className="flex flex-wrap gap-3">
                      {inPeriod.map((slot) => {
                        const selected = slot.key === time;
                        return (
                          <button
                            key={slot.key}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => setTime(slot.key)}
                            className={`min-h-12 rounded-xl px-6 text-lg font-medium tabular-nums transition-colors ${
                              selected
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-surface-muted hover:bg-surface-sunken'
                            }`}
                          >
                            {slot.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
          </div>
        </Step>

        <section
          aria-live="polite"
          aria-label="New time"
          className="flex flex-col gap-3 rounded-panel bg-surface-sunken p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6"
        >
          <div className="flex items-center gap-4">
            <span
              aria-hidden="true"
              className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-container text-on-primary-container"
            >
              <Icon name="calendar-edit" size={20} />
            </span>
            <div>
              <p className="text-sm text-muted">Selected time</p>
              <p className="text-xl font-medium sm:text-2xl">
                {chosen
                  ? `${format({ weekday: 'long', day: 'numeric', month: 'short' }, chosen.startsAt)} · ${chosen.label}`
                  : 'Choose a day and a start time'}
              </p>
            </div>
          </div>
          <div className="pl-15 sm:pl-0 sm:text-right">
            <p className="font-medium text-primary-text">{therapist?.displayName}</p>
            <p className="text-sm text-muted">{data.branchName}</p>
          </div>
        </section>

        <section
          aria-label="Confirm"
          className={`flex flex-col gap-6 rounded-panel border border-border-subtle bg-surface p-5 sm:p-8 ${SHADOW}`}
        >
          <p className="flex items-center gap-3 rounded-card bg-surface-muted px-4 py-3 text-sm sm:text-base">
            <Icon name="check-circle" size={20} className="shrink-0 text-success" />
            <span>
              No extra payment: invoice {data.invoice.number} of{' '}
              <span className="font-semibold">{formatPrice(data.invoice.amountCents)}</span> stays
              with the booking. We email you the new time.
            </span>
          </p>
          <RequestErrorAlert error={error} />
          <div className="flex flex-col-reverse gap-4 sm:flex-row sm:items-center sm:justify-between">
            <Link href={back} className="text-center font-medium text-muted hover:text-foreground">
              Keep the current time
            </Link>
            <Button size="lg" disabled={!chosen || reschedule.isPending} onClick={confirm}>
              {reschedule.isPending ? 'Moving…' : 'Confirm new time'}
              <Icon name="arrow-right" size={18} />
            </Button>
          </div>
        </section>
      </div>
    </main>
  );
}

function Step({
  number,
  title,
  note,
  children,
}: Readonly<{ number: number; title: string; note: string; children: ReactNode }>) {
  const id = `reschedule-step-${number}`;
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h2 id={id} className="flex items-center gap-3 text-xl font-medium">
          <span
            aria-hidden="true"
            className="flex size-7 items-center justify-center rounded-full bg-primary-container text-sm font-semibold text-on-primary-container"
          >
            {number}
          </span>
          {title}
        </h2>
        <p className="text-sm text-muted">{note}</p>
      </div>
      {children}
    </section>
  );
}
