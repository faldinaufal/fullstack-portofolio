// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import { Alert, Button, Card } from '@tempora/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  toBookableDays,
  useBranchPage,
  useBusinessPage,
} from '@/core/booking/presentation/use-booking';
import {
  rescheduleNotice,
  toReservationView,
  useReschedule,
  useRescheduleSlots,
  useReservation,
  type Reservation,
} from '@/core/reservation/presentation/use-reservation';
import { toRequestErrorView } from '@/core/shared/presentation/error-view';
import { RequestErrorAlert } from '@/ui/common/request-error';
import { ReservationLoading, ReservationPage, ReservationUnavailable } from './reservation-parts';

const choice = (selected: boolean) =>
  `rounded-xl border-2 px-3 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${
    selected ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-surface'
  }`;

/**
 * FSD 2.1 `/bookings/[id]/reschedule`, rule 6.5: same branch and service; the therapist may
 * change to another one of the branch who performs the service. Customers and guests.
 */
export function RescheduleScreen({ id }: Readonly<{ id: string }>) {
  const reservation = useReservation(id);
  if (reservation.isPending) return <ReservationLoading />;
  if (reservation.isError) return <ReservationUnavailable />;
  const notice = rescheduleNotice(reservation.data);
  if (!notice?.allowed) {
    return (
      <ReservationPage>
        <h1 className="text-[32px] leading-tight font-extrabold">Reschedule</h1>
        <Alert tone="info">{notice?.message ?? 'Only confirmed bookings can be moved.'}</Alert>
        <Link href={`/bookings/${id}`} className="font-semibold text-primary-text">
          Back to the booking
        </Link>
      </ReservationPage>
    );
  }
  return <RescheduleForm reservation={reservation.data} allowance={notice.message} />;
}

/** The choices, once the booking is known: its branch's therapists, days and free times. */
function RescheduleForm({
  reservation: data,
  allowance,
}: Readonly<{ reservation: Reservation; allowance: string }>) {
  const id = data.id;
  const router = useRouter();
  const business = useBusinessPage(data.business.slug);
  const branch = useBranchPage(data.business.slug, data.branchId);
  const [staffId, setStaffId] = useState(data.staffId);
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const reschedule = useReschedule(id);

  const days = toBookableDays(branch.data, business.data);
  const therapist = staffId;
  const day = date ?? days.find((d) => d.open)?.date ?? null;
  const slots = useRescheduleSlots(
    id,
    day ? { date: day, staffId } : null,
    business.data?.timeZone,
  );

  if (business.isPending || branch.isPending) return <ReservationLoading />;
  if (business.isError || branch.isError) return <ReservationUnavailable />;
  const view = toReservationView(data);
  const notice = { message: allowance };
  const back = `/bookings/${id}`;

  const therapists = branch.data.therapistsFor(data.serviceId);
  const chosen = slots.data?.find((slot) => slot.key === time);
  const error = toRequestErrorView(reschedule.error, {
    SLOT_TAKEN: 'This time was just taken. Please choose another one.',
  });
  const confirm = () =>
    chosen &&
    reschedule.mutate(
      { startsAt: chosen.startsAt, staffId: therapist },
      { onSuccess: () => router.push(`${back}?rescheduled=1`) },
    );

  return (
    <ReservationPage>
      <div className="flex flex-col gap-1">
        <h1 className="text-[32px] leading-tight font-extrabold">Reschedule</h1>
        <p className="m-0 text-muted">
          {view.serviceName} at {view.business.name} · now {view.when} · {notice.message}
        </p>
      </div>

      <section aria-labelledby="therapist-title" className="flex flex-col gap-3">
        <h2 id="therapist-title" className="text-xl font-extrabold">
          Therapist
        </h2>
        <div className="flex flex-wrap gap-2">
          {therapists.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={t.id === therapist}
              onClick={() => {
                setStaffId(t.id);
                setTime(null);
              }}
              className={choice(t.id === therapist)}
            >
              {t.displayName}
            </button>
          ))}
        </div>
      </section>

      <section aria-labelledby="day-title" className="flex flex-col gap-3">
        <h2 id="day-title" className="text-xl font-extrabold">
          New day
        </h2>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2" role="listbox" aria-label="Day">
          {days.map((d) => (
            <button
              key={d.date}
              type="button"
              role="option"
              aria-selected={d.date === day}
              disabled={!d.open}
              onClick={() => {
                setDate(d.date);
                setTime(null);
              }}
              className={`min-w-[76px] shrink-0 ${choice(d.date === day)}`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </section>

      <section aria-labelledby="time-title" className="flex flex-col gap-3">
        <h2 id="time-title" className="text-xl font-extrabold">
          New time <span className="text-sm font-normal text-muted">({view.timeZone})</span>
        </h2>
        {slots.isPending && <div className="h-24 animate-pulse rounded-card bg-surface-muted" />}
        {slots.isError && <Alert tone="danger">Free times could not be loaded.</Alert>}
        {slots.data?.length === 0 && (
          <p className="text-sm text-muted">No free times on this day. Try another day.</p>
        )}
        {slots.data && slots.data.length > 0 && (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-2">
            {slots.data.map((slot) => (
              <button
                key={slot.key}
                type="button"
                aria-pressed={slot.key === time}
                onClick={() => setTime(slot.key)}
                className={choice(slot.key === time)}
              >
                {slot.label}
              </button>
            ))}
          </div>
        )}
      </section>

      <Card className="flex flex-col gap-3 p-5">
        <RequestErrorAlert error={error} />
        <div className="flex flex-wrap items-center gap-3">
          <Button size="lg" disabled={!chosen || reschedule.isPending} onClick={confirm}>
            {reschedule.isPending ? 'Moving…' : 'Move booking'}
          </Button>
          <Link href={back} className="font-semibold text-primary-text">
            Keep the current time
          </Link>
        </div>
        <p className="m-0 text-xs text-muted">
          The invoice and payment stay the same. You get an email with the new time.
        </p>
      </Card>
    </ReservationPage>
  );
}
