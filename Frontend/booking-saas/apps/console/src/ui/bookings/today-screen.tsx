// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import { Alert, Badge, Button, Card, CardContent } from '@tempora/ui';
import Link from 'next/link';
import { useState } from 'react';
import { useCurrentMember } from '@/core/auth/presentation/use-auth';
import {
  dateIn,
  STATUS,
  timeIn,
  useBookingActions,
  useCalendar,
  type CalendarData,
} from '@/core/bookings/presentation/use-bookings';
import { toRequestErrorView } from '@/core/shared/presentation/error-view';
import { PLATFORM_TIME_ZONE } from '@/core/shared/presentation/time-zone';
import { PageHeader } from '@/ui/common/page-header';
import { RequestErrorAlert } from '@/ui/common/request-error';

/** FSD 2.2 "Today" (staff home), flow 3.7: today's sessions with name and notes, and marking. */
export function TodayScreen() {
  const member = useCurrentMember();
  const [today] = useState(() => dateIn(PLATFORM_TIME_ZONE, new Date()));
  const calendar = useCalendar({ from: today, to: today });

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={`Hello, ${member.shortName.split(' ')[0]}`}
        description="Your sessions today. Mark each one once it has started."
      />
      {calendar.isError && <Alert tone="danger">Today’s sessions could not be loaded.</Alert>}
      {calendar.isPending && <div className="h-40 animate-pulse rounded-card bg-surface-muted" />}
      {calendar.data && calendar.data.bookings.length === 0 && (
        <Card>
          <CardContent className="p-6 text-muted">No sessions today.</CardContent>
        </Card>
      )}
      {calendar.data && (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {calendar.data.bookings.map((b) => (
            <li key={b.id}>
              <Session booking={b} timeZone={calendar.data.timeZone} />
            </li>
          ))}
        </ul>
      )}
      <Link href="/calendar" className="font-semibold text-primary-text">
        Open my calendar
      </Link>
    </div>
  );
}

function Session({
  booking,
  timeZone,
}: Readonly<{ booking: CalendarData['bookings'][number]; timeZone: string }>) {
  const actions = useBookingActions(booking.id);
  const status = STATUS[booking.status];
  const started = booking.startsAt <= new Date();
  const error = toRequestErrorView(actions.complete.error ?? actions.noShow.error, {
    NOT_MARKABLE: 'This session cannot be marked any more. Ask your manager.',
  });
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <span>
            <span className="block text-lg font-extrabold">
              {timeIn(booking.startsAt, timeZone)}–{timeIn(booking.endsAt, timeZone)} ·{' '}
              {booking.customerName}
            </span>
            <span className="text-sm text-muted">{booking.serviceName}</span>
          </span>
          <Badge tone={status.tone} dot>
            {status.label}
          </Badge>
        </div>
        {booking.notes && (
          <p className="m-0 rounded-xl bg-surface-muted p-3 text-sm whitespace-pre-line">
            {booking.notes}
          </p>
        )}
        <RequestErrorAlert error={error} />
        {booking.status === 'confirmed' && started && (
          <div className="flex gap-2">
            <Button onClick={() => actions.complete.mutate()} disabled={actions.complete.isPending}>
              Completed
            </Button>
            <Button
              variant="secondary"
              onClick={() => actions.noShow.mutate()}
              disabled={actions.noShow.isPending}
            >
              No-show
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
