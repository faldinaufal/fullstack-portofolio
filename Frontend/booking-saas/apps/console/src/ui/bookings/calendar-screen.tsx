// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import { Alert, Button, Card, CardContent, SelectField } from '@tempora/ui';
import Link from 'next/link';
import { useState } from 'react';
import { useCurrentMember } from '@/core/auth/presentation/use-auth';
import {
  addDays,
  dateIn,
  placeBlock,
  STATUS,
  timeIn,
  useCalendar,
  type CalendarData,
} from '@/core/bookings/presentation/use-bookings';
import { useBranches } from '@/core/branches/presentation/use-branches';
import { PLATFORM_TIME_ZONE } from '@/core/shared/presentation/time-zone';
import { PageHeader } from '@/ui/common/page-header';

/** Visible hours of the day view; sessions outside them are cut off at the edge. */
const FIRST_HOUR = 7;
const LAST_HOUR = 21;
/** Pixels per minute in the day view. */
const SCALE = 1;

const dayLabel = (date: string) =>
  new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`));

const TONE_CLASS: Record<string, string> = {
  warning: 'border-warning bg-warning-soft',
  success: 'border-primary bg-primary-soft',
  info: 'border-info bg-info-soft',
  danger: 'border-danger bg-danger-soft',
  neutral: 'border-border bg-surface-muted',
};

/**
 * FSD 2.2 `/calendar`: day view with one column per therapist, or the week as a list per day.
 * Times are on the business's clock. Staff see only their own column.
 */
export function CalendarScreen() {
  const member = useCurrentMember();
  const branches = useBranches();
  const [view, setView] = useState<'day' | 'week'>('day');
  const [date, setDate] = useState(() => dateIn(PLATFORM_TIME_ZONE, new Date()));
  const [branchId, setBranchId] = useState<string | undefined>(undefined);
  const range = view === 'day' ? { from: date, to: date } : { from: date, to: addDays(date, 6) };
  const calendar = useCalendar({ ...range, ...(branchId && { branchId }) });
  const step = view === 'day' ? 1 : 7;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Calendar"
        description={
          calendar.data ? `${calendar.data.branch.name} · ${calendar.data.timeZone}` : ''
        }
        actions={
          <div className="flex gap-2" role="group" aria-label="View">
            {(['day', 'week'] as const).map((v) => (
              <Button
                key={v}
                variant={view === v ? 'primary' : 'secondary'}
                aria-pressed={view === v}
                onClick={() => setView(v)}
              >
                {v === 'day' ? 'Day' : 'Week'}
              </Button>
            ))}
          </div>
        }
      />

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <Button variant="secondary" onClick={() => setDate(addDays(date, -step))}>
            Previous
          </Button>
          <Button
            variant="ghost"
            onClick={() =>
              setDate(dateIn(calendar.data?.timeZone ?? PLATFORM_TIME_ZONE, new Date()))
            }
          >
            Today
          </Button>
          <Button variant="secondary" onClick={() => setDate(addDays(date, step))}>
            Next
          </Button>
          <span className="font-semibold">
            {view === 'day' ? dayLabel(date) : `${dayLabel(range.from)} – ${dayLabel(range.to)}`}
          </span>
          {member.role === 'owner' && (branches.data?.length ?? 0) > 1 && (
            <div className="ml-auto min-w-[200px]">
              <SelectField
                label="Branch"
                options={(branches.data ?? []).map((b) => ({ value: b.id, label: b.name }))}
                value={branchId ?? calendar.data?.branch.id ?? ''}
                onChange={(e) => setBranchId(e.target.value)}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {calendar.isError && <Alert tone="danger">The calendar could not be loaded.</Alert>}
      {calendar.isPending && <div className="h-96 animate-pulse rounded-card bg-surface-muted" />}
      {calendar.data &&
        (view === 'day' ? (
          <DayView data={calendar.data} date={date} />
        ) : (
          <WeekView data={calendar.data} from={range.from} />
        ))}
    </div>
  );
}

function DayView({ data, date }: Readonly<{ data: CalendarData; date: string }>) {
  const height = (LAST_HOUR - FIRST_HOUR) * 60 * SCALE;
  const hours = Array.from({ length: LAST_HOUR - FIRST_HOUR }, (_, i) => FIRST_HOUR + i);
  if (data.therapists.length === 0) {
    return <Alert tone="info">Nobody works at this branch yet.</Alert>;
  }
  return (
    <Card>
      <CardContent className="overflow-x-auto p-4">
        <div
          className="grid min-w-[480px] gap-2"
          style={{
            gridTemplateColumns: `56px repeat(${data.therapists.length}, minmax(160px, 1fr))`,
          }}
        >
          <div />
          {data.therapists.map((t) => (
            <div key={t.id} className="pb-2 text-sm font-bold">
              {t.name}
            </div>
          ))}

          <div className="relative" style={{ height }}>
            {hours.map((hour) => (
              <span
                key={hour}
                className="absolute right-2 text-xs text-muted"
                style={{ top: (hour - FIRST_HOUR) * 60 * SCALE - 6 }}
              >
                {String(hour).padStart(2, '0')}:00
              </span>
            ))}
          </div>

          {data.therapists.map((t) => (
            <div
              key={t.id}
              className="relative rounded-xl border border-border bg-surface"
              style={{ height }}
              aria-label={`${t.name} on ${dayLabel(date)}`}
            >
              {hours.map((hour) => (
                <div
                  key={hour}
                  className="absolute inset-x-0 border-t border-border/60"
                  style={{ top: (hour - FIRST_HOUR) * 60 * SCALE }}
                />
              ))}
              {data.timeOff
                .filter((off) => off.staffId === t.id)
                .map((off) => {
                  const place = placeBlock(off, date, data.timeZone, FIRST_HOUR, LAST_HOUR);
                  if (!place) return null;
                  return (
                    <div
                      key={off.id}
                      className="absolute inset-x-1 rounded-lg bg-[repeating-linear-gradient(45deg,var(--color-surface-muted),var(--color-surface-muted)_6px,transparent_6px,transparent_12px)] p-1 text-xs text-muted"
                      style={{ top: place.top * SCALE, height: place.height * SCALE }}
                    >
                      Time off{off.reason ? `: ${off.reason}` : ''}
                    </div>
                  );
                })}
              {data.bookings
                .filter((b) => b.staffId === t.id)
                .map((b) => {
                  const place = placeBlock(b, date, data.timeZone, FIRST_HOUR, LAST_HOUR);
                  if (!place) return null;
                  const tone = STATUS[b.status].tone;
                  return (
                    <Link
                      key={b.id}
                      href={`/bookings/${b.id}`}
                      className={`absolute inset-x-1 overflow-hidden rounded-lg border-l-4 p-1.5 text-xs hover:brightness-95 ${TONE_CLASS[tone]}`}
                      style={{ top: place.top * SCALE, height: place.height * SCALE }}
                    >
                      <span className="block font-bold">
                        {timeIn(b.startsAt, data.timeZone)} {b.customerName}
                      </span>
                      <span className="block">{b.serviceName}</span>
                      {b.status !== 'confirmed' && (
                        <span className="block text-muted">{STATUS[b.status].label}</span>
                      )}
                    </Link>
                  );
                })}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function WeekView({ data, from }: Readonly<{ data: CalendarData; from: string }>) {
  const names = new Map(data.therapists.map((t) => [t.id, t.name]));
  const days = Array.from({ length: 7 }, (_, i) => addDays(from, i));
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {days.map((day) => {
        const sessions = data.bookings.filter((b) => dateIn(data.timeZone, b.startsAt) === day);
        return (
          <Card key={day}>
            <CardContent className="flex flex-col gap-2 p-4">
              <span className="font-bold">{dayLabel(day)}</span>
              {sessions.length === 0 && <span className="text-sm text-muted">No bookings</span>}
              {sessions.map((b) => (
                <Link
                  key={b.id}
                  href={`/bookings/${b.id}`}
                  className={`rounded-lg border-l-4 p-2 text-sm ${TONE_CLASS[STATUS[b.status].tone]}`}
                >
                  <span className="font-semibold">
                    {timeIn(b.startsAt, data.timeZone)}–{timeIn(b.endsAt, data.timeZone)}
                  </span>{' '}
                  {b.customerName}
                  <span className="block text-xs text-muted">
                    {b.serviceName} · {names.get(b.staffId)}
                  </span>
                </Link>
              ))}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
