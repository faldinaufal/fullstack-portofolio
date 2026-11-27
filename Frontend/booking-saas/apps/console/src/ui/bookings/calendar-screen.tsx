// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import { Alert, Icon, Select } from '@tempora/ui';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { useCurrentMember } from '@/core/auth/presentation/use-auth';
import {
  addDays,
  dateIn,
  minutesInDay,
  placeBlock,
  STATUS,
  timeIn,
  useCalendar,
  type CalendarBooking,
  type CalendarData,
} from '@/core/bookings/presentation/use-bookings';
import { useBranches } from '@/core/branches/presentation/use-branches';
import { PLATFORM_TIME_ZONE } from '@/core/shared/presentation/time-zone';

/** Hours always shown in the day view; it grows to fit earlier or later sessions. */
const DEFAULT_FIRST_HOUR = 8;
const DEFAULT_LAST_HOUR = 18;
/** Pixels per minute in the day view (96 px per hour). */
const SCALE = 1.6;

const PANEL =
  'rounded-panel border border-border-subtle bg-surface shadow-[0_1px_3px_rgba(31,28,27,0.06)]';

const fullDay = (date: string) =>
  new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`));

const shortDay = (date: string) =>
  new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`));

/** Colours per status tone: the block, its accent edge and the time pill (DESIGN 3). */
const TONE: Record<string, { block: string; pill: string }> = {
  success: {
    block: 'border-success bg-success-soft',
    pill: 'bg-success-container text-success',
  },
  warning: { block: 'border-warning bg-warning-soft', pill: 'bg-surface text-warning' },
  info: { block: 'border-info bg-info-soft', pill: 'bg-surface text-info' },
  danger: { block: 'border-danger bg-danger-soft', pill: 'bg-surface text-danger' },
  neutral: { block: 'border-border-strong bg-surface-muted', pill: 'bg-surface text-muted' },
};

/** The calendar shows active and finished bookings only (FSD 5.2 `GET /calendar`). */
const LEGEND = [
  { label: 'Confirmed', swatch: 'bg-success-soft border-success border-l-[3px]' },
  { label: 'Awaiting payment', swatch: 'bg-warning-soft border-warning border-l-[3px]' },
  { label: 'Completed', swatch: 'bg-info-soft border-info border-l-[3px]' },
  { label: 'No-show', swatch: 'bg-danger-soft border-danger border-l-[3px]' },
  { label: 'Buffer', swatch: 'bg-surface-muted border border-dashed border-border' },
];

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('');

/**
 * FSD 2.2 `/calendar` (DESIGN 5.2, Figma `3:3457`): day view with one column per therapist,
 * or the week as a list per day. Times are on the business's clock. Staff see only their own
 * column. Figma's Month view, rooms, "In session" and per-therapist buffers are left out
 * (DESIGN 4.1, 4.2): the buffer belongs to the service and follows each session.
 */
export function CalendarScreen() {
  const member = useCurrentMember();
  const branches = useBranches();
  const [view, setView] = useState<'day' | 'week'>('day');
  const [date, setDate] = useState(() => dateIn(PLATFORM_TIME_ZONE, new Date()));
  const [branchId, setBranchId] = useState<string | undefined>(undefined);
  // Therapists picked in the team row; empty means everyone.
  const [picked, setPicked] = useState<ReadonlySet<string>>(() => new Set());
  const range = view === 'day' ? { from: date, to: date } : { from: date, to: addDays(date, 6) };
  const calendar = useCalendar({ ...range, ...(branchId && { branchId }) });
  const step = view === 'day' ? 1 : 7;
  const data = calendar.data;
  const therapists = data?.therapists ?? [];
  // Ignore picks that are not in this branch (e.g. after switching branch).
  const active = new Set(therapists.filter((t) => picked.has(t.id)).map((t) => t.id));
  const shown = active.size === 0 ? therapists : therapists.filter((t) => active.has(t.id));
  const toggle = (id: string) =>
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
        <div className="mr-auto">
          <p className="text-sm font-medium tracking-wider text-muted uppercase">
            Therapist schedule{data ? ` · ${data.branch.name}` : ''}
          </p>
          <h1 className="text-[30px] font-semibold tracking-tight sm:text-[36px]">Calendar</h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 rounded-xl bg-surface-muted p-1">
            <NavButton
              label={view === 'day' ? 'Previous day' : 'Previous week'}
              icon="chevron-left"
              onClick={() => setDate(addDays(date, -step))}
            />
            <button
              type="button"
              onClick={() => setDate(dateIn(data?.timeZone ?? PLATFORM_TIME_ZONE, new Date()))}
              className="min-h-9 rounded-lg px-3 text-sm font-medium text-muted transition-colors hover:bg-surface hover:text-foreground"
            >
              Today
            </button>
            <NavButton
              label={view === 'day' ? 'Next day' : 'Next week'}
              icon="chevron-right"
              onClick={() => setDate(addDays(date, step))}
            />
            <span aria-hidden="true" className="mx-1 size-1.5 rounded-full bg-primary" />
            <p aria-live="polite" className="px-2 text-base font-medium sm:text-lg">
              {view === 'day' ? fullDay(date) : `${shortDay(range.from)} – ${shortDay(range.to)}`}
            </p>
          </div>

          <div
            role="radiogroup"
            aria-label="View"
            className="flex gap-1 rounded-xl bg-surface-muted p-1"
          >
            {(['day', 'week'] as const).map((v) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={view === v}
                onClick={() => setView(v)}
                className={`min-h-9 rounded-lg px-5 text-sm font-medium transition-colors ${
                  view === v
                    ? 'bg-surface text-foreground shadow-[0_1px_3px_rgba(31,28,27,0.12)]'
                    : 'text-muted hover:text-foreground'
                }`}
              >
                {v === 'day' ? 'Day' : 'Week'}
              </button>
            ))}
          </div>

          {member.role === 'owner' && (branches.data?.length ?? 0) > 1 && (
            <div className="min-w-[200px]">
              <Select
                label="Branch"
                options={(branches.data ?? []).map((b) => ({ value: b.id, label: b.name }))}
                value={branchId ?? data?.branch.id ?? ''}
                onValueChange={(value) => {
                  setBranchId(value);
                  setPicked(new Set());
                }}
              />
            </div>
          )}
        </div>
      </div>

      {therapists.length > 1 && (
        <div className="flex flex-col gap-3">
          {/* One row that scrolls sideways when the team does not fit, so it never grows tall. */}
          <fieldset className="m-0 flex min-w-0 items-center gap-2 border-0 p-0">
            <legend className="sr-only">Therapists to show</legend>
            <span
              aria-hidden="true"
              className="shrink-0 text-sm font-medium tracking-wider text-muted uppercase"
            >
              Team:
            </span>
            <div className="-my-1 flex min-w-0 gap-2 overflow-x-auto px-1 py-1 scrollbar-thin">
              <Chip active={active.size === 0} onClick={() => setPicked(new Set())}>
                <span aria-hidden="true" className="size-2 rounded-full bg-current" />
                <span>All therapists</span>
                <span className="opacity-70">
                  {active.size > 0 ? `${active.size} of ${therapists.length}` : therapists.length}
                </span>
              </Chip>
              {therapists.map((t, index) => (
                <Chip key={t.id} active={active.has(t.id)} onClick={() => toggle(t.id)}>
                  <Initials name={t.name} index={index} small />
                  {t.name}
                </Chip>
              ))}
            </div>
          </fieldset>
          <Legend className="sm:justify-end" />
        </div>
      )}

      {calendar.isError && <Alert tone="danger">The calendar could not be loaded.</Alert>}
      {calendar.isPending && <div className="h-96 animate-pulse rounded-panel bg-surface-muted" />}
      {data &&
        (therapists.length === 0 ? (
          <Alert tone="info">Nobody works at this branch yet.</Alert>
        ) : view === 'day' ? (
          <DayView data={data} date={date} therapists={shown} />
        ) : (
          <WeekView data={data} from={range.from} shown={active} />
        ))}
      {data && therapists.length === 1 && <Legend />}
    </div>
  );
}

function DayView({
  data,
  date,
  therapists,
}: Readonly<{ data: CalendarData; date: string; therapists: CalendarData['therapists'] }>) {
  const { timeZone } = data;
  const today = data.bookings.filter((b) => dateIn(timeZone, b.startsAt) === date);
  // Grow the visible hours to fit every session (and its buffer) of the day.
  const first = Math.min(
    DEFAULT_FIRST_HOUR,
    ...today.map((b) => Math.floor(minutesInDay(b.startsAt, timeZone) / 60)),
  );
  const last = Math.max(
    DEFAULT_LAST_HOUR,
    ...today.map((b) => Math.min(24, Math.ceil(minutesInDay(b.blockedUntil, timeZone) / 60) || 24)),
  );
  const hours = Array.from({ length: last - first }, (_, i) => first + i);
  const height = (last - first) * 60 * SCALE;
  // Narrower columns once the team is large, so more of it fits on screen at once.
  const columnWidth = therapists.length > 4 ? 200 : 240;
  const columns = `80px repeat(${therapists.length}, minmax(${columnWidth}px, 1fr))`;
  const indexOf = new Map(data.therapists.map((t, i) => [t.id, i]));

  return (
    <div className={`overflow-hidden ${PANEL}`}>
      {/*
        One scroll area for both directions, so the time column can stick to the left and the
        therapist names to the top while scrolling through a large team or a long day.
      */}
      <div className="max-h-[calc(100dvh-20rem)] min-h-96 overflow-auto overscroll-contain">
        <div className="min-w-fit">
          <div
            className="sticky top-0 z-20 grid border-b border-border-subtle bg-surface"
            style={{ gridTemplateColumns: columns }}
          >
            <div className="sticky left-0 z-10 flex items-center justify-center bg-surface text-xs font-medium tracking-wider text-muted uppercase">
              Time
            </div>
            {therapists.map((t) => {
              const sessions = today.filter((b) => b.staffId === t.id).length;
              return (
                <div
                  key={t.id}
                  className={`flex items-center gap-3 border-l border-border-subtle py-5 ${
                    columnWidth < 240 ? 'px-4' : 'px-5'
                  }`}
                >
                  <Initials name={t.name} index={indexOf.get(t.id) ?? 0} />
                  <div className="min-w-0">
                    <p className="truncate text-lg font-medium">{t.name}</p>
                    <p className="font-mono text-xs text-muted">
                      {sessions} {sessions === 1 ? 'session' : 'sessions'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid" style={{ gridTemplateColumns: columns }}>
            <div className="sticky left-0 z-10 bg-surface" style={{ height }}>
              {hours.map((hour) => (
                <span
                  key={hour}
                  className="absolute inset-x-0 text-center font-mono text-sm text-muted"
                  style={{ top: (hour - first) * 60 * SCALE + 12 }}
                >
                  {String(hour).padStart(2, '0')}:00
                </span>
              ))}
            </div>

            {therapists.map((t) => (
              <div
                key={t.id}
                role="group"
                aria-label={`${t.name} on ${fullDay(date)}`}
                className="relative border-l border-border-subtle"
                style={{ height }}
              >
                {hours.map((hour) => (
                  <div
                    key={hour}
                    className="absolute inset-x-0 border-t border-border-subtle first:border-t-0"
                    style={{ top: (hour - first) * 60 * SCALE }}
                  />
                ))}
                {data.timeOff
                  .filter((off) => off.staffId === t.id)
                  .map((off) => {
                    const place = placeBlock(off, date, timeZone, first, last);
                    if (!place) return null;
                    return (
                      <div
                        key={off.id}
                        className="absolute inset-x-3 flex items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-surface-muted px-3 text-center text-muted"
                        style={{ top: place.top * SCALE + 2, height: place.height * SCALE - 4 }}
                      >
                        <span className="line-clamp-2">
                          Time off{off.reason ? ` · ${off.reason}` : ''}
                        </span>
                      </div>
                    );
                  })}
                {today
                  .filter((b) => b.staffId === t.id)
                  .map((b) => (
                    <SessionBlock
                      key={b.id}
                      booking={b}
                      date={date}
                      data={data}
                      first={first}
                      last={last}
                    />
                  ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SessionBlock({
  booking: b,
  date,
  data,
  first,
  last,
}: Readonly<{
  booking: CalendarBooking;
  date: string;
  data: CalendarData;
  first: number;
  last: number;
}>) {
  const place = placeBlock(b, date, data.timeZone, first, last);
  if (!place) return null;
  const tone = TONE[STATUS[b.status].tone]!;
  const top = place.top * SCALE + 2;
  const blockHeight = place.height * SCALE - 4;
  const compact = blockHeight < 64;
  const bufferMinutes = Math.round(place.bufferHeight);
  return (
    <>
      <Link
        href={`/bookings/${b.id}`}
        className={`absolute inset-x-3 flex gap-2 overflow-hidden rounded-xl border-l-[3px] px-4 shadow-[0_1px_3px_rgba(31,28,27,0.06)] transition-[filter] hover:brightness-[0.97] ${
          compact ? 'items-center py-1' : 'items-start py-3'
        } ${tone.block}`}
        style={{ top, height: blockHeight }}
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{b.customerName}</span>
          <span className={`block truncate text-muted ${compact ? 'sr-only' : ''}`}>
            {b.serviceName}
            {b.status !== 'confirmed' && ` · ${STATUS[b.status].label}`}
          </span>
        </span>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-sm font-medium tabular-nums ${tone.pill}`}
        >
          {timeIn(b.startsAt, data.timeZone)}
        </span>
      </Link>
      {place.bufferHeight * SCALE >= 14 && (
        <div
          aria-hidden="true"
          className="absolute inset-x-3 flex items-center justify-center overflow-hidden rounded-lg border border-dashed border-border bg-surface-muted text-xs text-muted"
          style={{ top: top + blockHeight + 2, height: place.bufferHeight * SCALE - 2 }}
        >
          {place.bufferHeight * SCALE >= 20 && `${bufferMinutes} min buffer`}
        </div>
      )}
    </>
  );
}

function WeekView({
  data,
  from,
  shown,
}: Readonly<{ data: CalendarData; from: string; shown: ReadonlySet<string> }>) {
  const names = new Map(data.therapists.map((t) => [t.id, t.name]));
  const days = Array.from({ length: 7 }, (_, i) => addDays(from, i));
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {days.map((day) => {
        const sessions = data.bookings.filter(
          (b) =>
            dateIn(data.timeZone, b.startsAt) === day && (shown.size === 0 || shown.has(b.staffId)),
        );
        return (
          <section
            key={day}
            aria-label={fullDay(day)}
            className={`flex flex-col gap-3 p-4 ${PANEL}`}
          >
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="font-medium">{shortDay(day)}</h2>
              <span className="font-mono text-xs text-muted">
                {sessions.length} {sessions.length === 1 ? 'session' : 'sessions'}
              </span>
            </div>
            {sessions.length === 0 && <p className="text-sm text-muted">No bookings</p>}
            {sessions.map((b) => {
              const tone = TONE[STATUS[b.status].tone]!;
              return (
                <Link
                  key={b.id}
                  href={`/bookings/${b.id}`}
                  className={`flex items-start gap-2 rounded-xl border-l-[3px] px-3 py-2.5 text-sm transition-[filter] hover:brightness-[0.97] ${tone.block}`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{b.customerName}</span>
                    <span className="block truncate text-muted">
                      {b.serviceName} · {names.get(b.staffId)}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ${tone.pill}`}
                  >
                    {timeIn(b.startsAt, data.timeZone)}
                  </span>
                </Link>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}

function NavButton({
  label,
  icon,
  onClick,
}: Readonly<{ label: string; icon: 'chevron-left' | 'chevron-right'; onClick: () => void }>) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex size-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface hover:text-foreground"
    >
      <Icon name={icon} size={18} />
    </button>
  );
}

function Chip({
  active,
  onClick,
  children,
}: Readonly<{ active: boolean; onClick: () => void; children: ReactNode }>) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`flex min-h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-medium whitespace-nowrap transition-colors ${
        active
          ? 'bg-primary-container text-on-primary-container'
          : 'bg-surface text-foreground shadow-[0_1px_3px_rgba(31,28,27,0.08)] hover:bg-surface-muted'
      }`}
    >
      {children}
    </button>
  );
}

/** Therapist initials; alternating tones tell neighbouring columns apart. */
function Initials({
  name,
  index,
  small = false,
}: Readonly<{ name: string; index: number; small?: boolean }>) {
  const tones = [
    'bg-primary-container text-on-primary-container',
    'bg-success-soft text-success',
    'bg-surface-sunken text-foreground',
  ];
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full font-medium ${
        small ? 'size-7 text-xs' : 'size-12 text-base'
      } ${tones[index % tones.length]}`}
    >
      {initialsOf(name)}
    </span>
  );
}

function Legend({ className = '' }: Readonly<{ className?: string }>) {
  return (
    <ul
      className={`m-0 flex list-none flex-wrap gap-x-5 gap-y-2 p-0 text-sm text-muted ${className}`}
    >
      {LEGEND.map((item) => (
        <li key={item.label} className="flex items-center gap-2">
          <span aria-hidden="true" className={`h-3.5 w-5 rounded-sm ${item.swatch}`} />
          {item.label}
        </li>
      ))}
    </ul>
  );
}
