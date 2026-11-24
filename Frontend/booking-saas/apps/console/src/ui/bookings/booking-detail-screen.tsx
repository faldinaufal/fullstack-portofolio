// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  Select,
  TextField,
} from '@tempora/ui';
import Link from 'next/link';
import { useState } from 'react';
import {
  actionLabel,
  dateIn,
  formatPrice,
  formatWhen,
  STATUS,
  timeIn,
  useBooking,
  useBookingActions,
  useCalendar,
  useMoveSlots,
  type BookingDetail,
} from '@/core/bookings/presentation/use-bookings';
import { useCurrentMember } from '@/core/auth/presentation/use-auth';
import { toRequestErrorView } from '@/core/shared/presentation/error-view';
import { PageHeader } from '@/ui/common/page-header';
import { RequestErrorAlert } from '@/ui/common/request-error';
import { SidePanel } from '@/ui/common/side-panel';

const timelineTime = (at: Date, timeZone: string) =>
  new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  }).format(at);

/** FSD 2.2 `/bookings/[id]`, flow 3.8: details, timeline and the actions the role allows. */
export function BookingDetailScreen({ id }: Readonly<{ id: string }>) {
  const booking = useBooking(id);
  if (booking.isPending)
    return <div className="h-64 animate-pulse rounded-card bg-surface-muted" />;
  if (booking.isError) {
    return (
      <Alert tone="danger">
        This booking does not exist or is outside your branch.{' '}
        <Link href="/bookings" className="font-semibold underline">
          Back to bookings
        </Link>
      </Alert>
    );
  }
  return <Detail booking={booking.data} />;
}

function Detail({ booking }: Readonly<{ booking: BookingDetail }>) {
  // Customer and invoice pages are for the owner and managers (FSD 2.2).
  const lead = useCurrentMember().role !== 'staff';
  const status = STATUS[booking.status];
  const tz = booking.timeZone;
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={booking.serviceName}
        description={`${formatWhen(booking, tz)} · ${booking.branch.name} · with ${booking.therapist.name}`}
        actions={
          <Badge tone={status.tone} dot>
            {status.label}
          </Badge>
        }
      />
      <ActionBar booking={booking} />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Customer</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-sm">
            {lead ? (
              <Link
                href={`/customers/${booking.customer.id}`}
                className="font-semibold text-primary-text"
              >
                {booking.customer.name}
              </Link>
            ) : (
              <span className="font-semibold">{booking.customer.name}</span>
            )}
            {booking.customer.email && <span>{booking.customer.email}</span>}
            {booking.customer.phone && <span>{booking.customer.phone}</span>}
            {booking.notes && (
              <p className="mt-2 mb-0 rounded-xl bg-surface-muted p-3 whitespace-pre-line">
                {booking.notes}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Payment</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-sm">
            <span>
              Invoice{' '}
              {lead ? (
                <Link href={`/invoices/${booking.invoice.id}`} className="text-primary-text">
                  {booking.invoice.number}
                </Link>
              ) : (
                booking.invoice.number
              )}{' '}
              · {formatPrice(booking.priceCents)} · {booking.invoice.status}
            </span>
            {booking.holdExpiresAt && (
              <span className="text-muted">
                Held until {timeIn(booking.holdExpiresAt, tz)} while the customer pays.
              </span>
            )}
            {booking.cancelReason && <span>Cancelled: {booking.cancelReason}</span>}
            {booking.refundHandledExternally && (
              <Alert tone="info">Paid and cancelled: refund the customer outside Tempora.</Alert>
            )}
          </CardContent>
        </Card>
      </div>

      {booking.timeline.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="m-0 flex list-none flex-col gap-3 p-0 text-sm">
              {booking.timeline.map((entry, index) => (
                <li key={`${entry.at.toISOString()}-${index}`} className="flex gap-3">
                  <span className="w-28 shrink-0 text-muted">{timelineTime(entry.at, tz)}</span>
                  <span>
                    <span className="font-semibold">{actionLabel(entry.action)}</span> by{' '}
                    {entry.actor}
                    {entry.reason && <span className="block text-muted">{entry.reason}</span>}
                  </span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/** Buttons for what the API allows this role to do now (FSD 6.5–6.7). */
function ActionBar({ booking }: Readonly<{ booking: BookingDetail }>) {
  const actions = useBookingActions(booking.id);
  const [moving, setMoving] = useState<'reschedule' | 'reassign' | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');
  const a = booking.actions;
  const error = toRequestErrorView(
    actions.complete.error ?? actions.noShow.error ?? actions.cancel.error,
  );
  if (!a.reschedule && !a.reassign && !a.cancel && !a.complete && !a.noShow) return null;

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-5">
        <RequestErrorAlert error={error} />
        <div className="flex flex-wrap gap-2">
          {a.complete && (
            <Button onClick={() => actions.complete.mutate()} disabled={actions.complete.isPending}>
              Mark completed
            </Button>
          )}
          {a.noShow && (
            <Button
              variant="secondary"
              onClick={() => actions.noShow.mutate()}
              disabled={actions.noShow.isPending}
            >
              Mark no-show
            </Button>
          )}
          {a.reschedule && (
            <Button variant="secondary" onClick={() => setMoving('reschedule')}>
              Reschedule
            </Button>
          )}
          {a.reassign && (
            <Button variant="secondary" onClick={() => setMoving('reassign')}>
              Another therapist
            </Button>
          )}
          {a.cancel && (
            <Button variant="danger" onClick={() => setCancelling(true)}>
              Cancel booking
            </Button>
          )}
        </div>
      </CardContent>

      <ConfirmDialog
        open={cancelling}
        title="Cancel this booking?"
        confirmLabel="Cancel booking"
        destructive
        busy={actions.cancel.isPending}
        onConfirm={() =>
          actions.cancel.mutate(a.cancelNeedsReason ? reason.trim() : undefined, {
            onSettled: () => setCancelling(false),
          })
        }
        onCancel={() => setCancelling(false)}
      >
        {a.cancelNeedsReason ? (
          <span className="flex flex-col gap-3">
            <span>
              It is paid: the customer is emailed with your reason, and you refund them outside
              Tempora.
            </span>
            <TextField
              label="Reason (sent to the customer)"
              value={reason}
              minLength={3}
              maxLength={500}
              onChange={(e) => setReason(e.target.value)}
            />
          </span>
        ) : (
          'The time is released and the unpaid invoice is voided. The customer is emailed.'
        )}
      </ConfirmDialog>

      {moving && <MoveDrawer booking={booking} mode={moving} onClose={() => setMoving(null)} />}
    </Card>
  );
}

/** Reschedule (new time, optionally another therapist) or reassign (same time). */
function MoveDrawer({
  booking,
  mode,
  onClose,
}: Readonly<{ booking: BookingDetail; mode: 'reschedule' | 'reassign'; onClose: () => void }>) {
  const tz = booking.timeZone;
  const [date, setDate] = useState(dateIn(tz, booking.startsAt));
  const [staffId, setStaffId] = useState(mode === 'reassign' ? '' : booking.therapist.id);
  const [time, setTime] = useState<string | null>(null);
  const actions = useBookingActions(booking.id);
  const calendar = useCalendar({ from: date, to: date, branchId: booking.branch.id });
  const slots = useMoveSlots(
    booking.id,
    mode === 'reschedule' && staffId ? { date, staffId } : null,
  );
  const therapists = (calendar.data?.therapists ?? []).filter(
    (t) => mode === 'reschedule' || t.id !== booking.therapist.id,
  );
  const busy = actions.reschedule.isPending || actions.reassign.isPending;
  const error = toRequestErrorView(
    actions.reschedule.error ?? actions.reassign.error ?? slots.error,
    {
      SERVICE_NOT_OFFERED: 'This therapist does not perform this service.',
    },
  );

  const save = () => {
    const done = { onSuccess: onClose };
    if (mode === 'reassign') actions.reassign.mutate(staffId, done);
    else if (time) actions.reschedule.mutate({ startsAt: new Date(time), staffId }, done);
  };

  return (
    <SidePanel
      open
      title={mode === 'reschedule' ? 'Reschedule' : 'Another therapist'}
      onClose={onClose}
    >
      <div className="flex flex-col gap-4">
        <p className="m-0 text-sm text-muted">
          Now {formatWhen(booking, tz)} with {booking.therapist.name}. The customer is emailed.
        </p>
        <Select
          label="Therapist"
          options={[
            ...(mode === 'reassign' ? [{ value: '', label: 'Choose a therapist' }] : []),
            ...therapists.map((t) => ({ value: t.id, label: t.name })),
          ]}
          value={staffId}
          onValueChange={(value) => {
            setStaffId(value);
            setTime(null);
          }}
        />
        {mode === 'reschedule' && (
          <>
            <TextField
              label="Day"
              type="date"
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setTime(null);
              }}
            />
            <div className="flex flex-col gap-2">
              <span className="text-sm font-semibold">Time ({tz})</span>
              {slots.isPending && staffId && (
                <div className="h-16 animate-pulse rounded-xl bg-surface-muted" />
              )}
              {slots.data?.length === 0 && (
                <span className="text-sm text-muted">No free times on this day.</span>
              )}
              <div className="grid grid-cols-[repeat(auto-fill,minmax(80px,1fr))] gap-2">
                {slots.data?.map((slot) => {
                  const key = slot.startsAt.toISOString();
                  return (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={key === time}
                      onClick={() => setTime(key)}
                      className={`rounded-xl border-2 px-2 py-2 text-sm font-semibold ${
                        key === time
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-surface'
                      }`}
                    >
                      {timeIn(slot.startsAt, tz)}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
        <RequestErrorAlert error={error} />
        <div className="flex gap-2">
          <Button onClick={save} disabled={busy || !staffId || (mode === 'reschedule' && !time)}>
            {busy ? 'Saving…' : 'Save'}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </SidePanel>
  );
}
