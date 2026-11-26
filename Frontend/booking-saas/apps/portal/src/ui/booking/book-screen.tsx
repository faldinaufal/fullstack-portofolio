// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import {
  Alert,
  BusinessLogo,
  Button,
  buttonVariants,
  Icon,
  TextField,
  TherapistPhoto,
} from '@tempora/ui';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState, type ReactNode, type SubmitEvent } from 'react';
import { useCustomer } from '@/core/account/presentation/use-account';
import {
  toBookableDays,
  useBranchPage,
  useBusinessPage,
  useSlots,
} from '@/core/booking/presentation/use-booking';
import { useReserve } from '@/core/reservation/presentation/use-reservation';
import { toRequestErrorView } from '@/core/shared/presentation/error-view';
import { NotFoundPanel, PageShell } from '@/ui/business/page-shell';
import { formText } from '@/ui/common/form-values';
import { RequestErrorAlert } from '@/ui/common/request-error';

/** Answers meaning the chosen time can no longer be booked: pick another one. */
const SLOT_GONE = new Set([
  'SLOT_TAKEN',
  'TOO_SOON',
  'OFF_GRID',
  'OUTSIDE_OPENING_HOURS',
  'OUTSIDE_WORKING_HOURS',
  'BRANCH_CLOSED',
  'THERAPIST_TIME_OFF',
]);

type Param = 'branch' | 'service' | 'staff' | 'date' | 'time';
/** Changing a choice clears the ones that depend on it. */
const DEPENDS: Record<Param, Param[]> = {
  branch: ['service', 'staff', 'date', 'time'],
  service: ['staff', 'time'],
  staff: ['time'],
  date: ['time'],
  time: [],
};

const dayPart = (date: string, part: 'weekday' | 'day') =>
  new Intl.DateTimeFormat('en-GB', {
    ...(part === 'weekday' ? { weekday: 'short' } : { day: 'numeric' }),
    timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`));

/**
 * FSD 2.1 `/[tenant]/book` (DESIGN 5.1, Figma `1:1751`): one page with the three steps
 * (service, therapist, date and time) and a summary that takes the guest details or a login
 * and starts the payment. Every choice lives in the URL, so a reload, a shared link or the
 * way back from the login page keeps it. Figma's ratings, room and full names are left out
 * (DESIGN 4.2); the 30-minute hold starts when the customer pays, not before (FSD 6.3).
 */
export function BookScreen({ slug }: Readonly<{ slug: string }>) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const business = useBusinessPage(slug);
  const branchId = params.get('branch') ?? business.data?.branches[0]?.id;
  const serviceId = params.get('service');
  const staffId = params.get('staff');
  const branch = useBranchPage(slug, branchId);
  const [switching, setSwitching] = useState(false);

  const days = toBookableDays(branch.data, business.data);
  const date = params.get('date') ?? days.find((d) => d.open)?.date ?? null;
  const time = params.get('time');
  const query =
    branchId && serviceId && staffId && date ? { branchId, serviceId, staffId, date } : null;
  const slots = useSlots(slug, query, business.data?.timeZone);

  if (business.isPending) return <PageShell loading />;
  if (business.isError || !business.data.available) return <NotFoundPanel />;

  const choose = (key: Param, value: string | null) => {
    const next = new URLSearchParams(params);
    if (branchId) next.set('branch', branchId);
    for (const dependent of DEPENDS[key]) next.delete(dependent);
    if (value === null) next.delete(key);
    else next.set(key, value);
    router.replace(`${pathname}?${next}`, { scroll: false });
  };

  const currentBranch = business.data.branches.find((b) => b.id === branchId);
  const services = branch.data?.services ?? [];
  const service = services.find((s) => s.id === serviceId);
  const therapists = service && branch.data ? branch.data.therapistsFor(service.id) : [];
  const therapist = therapists.find((t) => t.id === staffId);
  const slot = slots.data?.find((s) => s.key === time);

  return (
    <main className="px-4 py-10 sm:px-6 sm:py-14">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-8">
        <header className="flex flex-col gap-4 border-b border-border-subtle pb-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              <BusinessLogo
                name={business.data.name}
                url={business.data.logoUrl}
                className="size-14 text-lg"
              />
              <div className="min-w-0">
                <h1 className="text-2xl leading-tight font-semibold tracking-tight sm:text-3xl">
                  <span className="sr-only">Book a session at </span>
                  {business.data.name}
                </h1>
                {currentBranch && (
                  <p className="truncate text-muted">
                    {currentBranch.name} branch
                    {currentBranch.address && ` · ${currentBranch.address}`}
                  </p>
                )}
              </div>
            </div>
            {business.data.branches.length > 1 && (
              <button
                type="button"
                aria-expanded={switching}
                aria-controls="branch-switch"
                onClick={() => setSwitching(!switching)}
                className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg px-2 font-semibold text-primary-text hover:bg-surface-muted"
              >
                <Icon name="branches" size={18} /> Switch
                <span className="sr-only"> branch</span>
              </button>
            )}
          </div>
          {switching && (
            <fieldset id="branch-switch" className="m-0 flex flex-wrap gap-2 border-0 p-0">
              <legend className="sr-only">Branch</legend>
              {business.data.branches.map((b) => (
                <label
                  key={b.id}
                  className={`flex min-h-10 cursor-pointer items-center rounded-full px-4 text-sm font-semibold has-focus-visible:ring-2 has-focus-visible:ring-ring ${
                    b.id === branchId
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-surface-muted text-foreground hover:bg-border-subtle'
                  }`}
                >
                  <input
                    type="radio"
                    name="branch"
                    className="sr-only"
                    checked={b.id === branchId}
                    onChange={() => {
                      choose('branch', b.id);
                      setSwitching(false);
                    }}
                  />
                  {b.name}
                </label>
              ))}
            </fieldset>
          )}
        </header>

        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-8 lg:grid-cols-[minmax(0,1fr)_400px]">
          <div className="flex flex-col gap-8">
            <Step number={1} title="Service">
              {branch.isPending ? (
                <Skeleton rows={3} />
              ) : branch.isError ? (
                <Alert tone="danger">
                  Services could not be loaded. Please try again in a moment.
                </Alert>
              ) : (
                <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
                  <legend className="sr-only">Service</legend>
                  {services.map((s) => {
                    const checked = s.id === serviceId;
                    return (
                      <label key={s.id} className={choiceClass(checked, 'p-4 sm:px-5')}>
                        <input
                          type="radio"
                          name="service"
                          className="sr-only"
                          checked={checked}
                          onChange={() => choose('service', s.id)}
                        />
                        <Check checked={checked} />
                        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="text-base font-medium sm:text-lg">{s.name}</span>
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                              checked
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-surface-muted text-muted'
                            }`}
                          >
                            {s.durationMinutes} min
                          </span>
                        </span>
                        <span
                          className={`text-lg font-semibold tabular-nums sm:text-xl ${
                            checked ? 'text-primary-text' : ''
                          }`}
                        >
                          {s.price}
                        </span>
                      </label>
                    );
                  })}
                </fieldset>
              )}
            </Step>

            <Step number={2} title="Therapist">
              {!service ? (
                <Waiting>Choose a service to see who performs it.</Waiting>
              ) : (
                <fieldset className="m-0 grid gap-3 border-0 p-0 sm:grid-cols-2 xl:grid-cols-3">
                  <legend className="sr-only">Therapist</legend>
                  {therapists.map((t) => {
                    const checked = t.id === staffId;
                    const count = t.serviceIds.length;
                    return (
                      <label key={t.id} className={choiceClass(checked, 'p-3 pr-4')}>
                        <input
                          type="radio"
                          name="staff"
                          className="sr-only"
                          checked={checked}
                          onChange={() => choose('staff', t.id)}
                        />
                        <TherapistPhoto
                          name={t.displayName}
                          url={t.photoUrl}
                          className="size-14 rounded-full text-base"
                        />
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate text-lg font-medium">{t.displayName}</span>
                          <span className="text-sm text-muted">
                            {count} {count === 1 ? 'service' : 'services'}
                          </span>
                        </span>
                        {checked && <Check checked />}
                      </label>
                    );
                  })}
                </fieldset>
              )}
            </Step>

            <Step number={3} title="Date & time">
              {!therapist ? (
                <Waiting>Choose a therapist to see their free times.</Waiting>
              ) : (
                <div className="flex flex-col gap-6">
                  <div
                    role="listbox"
                    aria-label="Day"
                    className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1"
                  >
                    {days.map((day) => {
                      const selected = day.date === date;
                      return (
                        <button
                          key={day.date}
                          type="button"
                          role="option"
                          aria-selected={selected}
                          disabled={!day.open}
                          onClick={() => choose('date', day.date)}
                          className={`flex min-w-[76px] shrink-0 flex-col items-center gap-0.5 rounded-card px-3 py-3 disabled:cursor-not-allowed disabled:opacity-40 ${
                            selected
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-surface-muted hover:bg-border-subtle'
                          }`}
                        >
                          <span
                            className={`text-sm font-semibold ${selected ? 'opacity-80' : 'text-muted'}`}
                          >
                            {dayPart(day.date, 'weekday')}
                          </span>
                          <span className="text-2xl font-medium">{dayPart(day.date, 'day')}</span>
                          {!day.open && <span className="text-[11px]">Closed</span>}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex flex-col gap-3">
                    <p className="text-sm text-muted">
                      Times in {business.data.timeZone.replace(/_/g, ' ')}
                    </p>
                    {slots.isPending && <Skeleton rows={1} />}
                    {slots.isError && (
                      <Alert tone="danger">Free times could not be loaded. Please try again.</Alert>
                    )}
                    {slots.data?.length === 0 && (
                      <p className="text-muted">No free times on this day. Try another day.</p>
                    )}
                    {slots.data && slots.data.length > 0 && (
                      <div className="flex flex-wrap gap-3">
                        {slots.data.map((s) => {
                          const selected = s.key === time;
                          return (
                            <button
                              key={s.key}
                              type="button"
                              aria-pressed={selected}
                              onClick={() => choose('time', s.key)}
                              className={`min-h-11 rounded-xl px-5 font-medium tabular-nums ${
                                selected
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-surface-muted hover:bg-border-subtle'
                              }`}
                            >
                              {s.label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </Step>
          </div>

          <Summary
            slug={slug}
            branchId={branchId}
            branchName={currentBranch?.name ?? ''}
            timeZone={business.data.timeZone}
            service={service}
            therapist={therapist}
            slot={slot ? { startsAt: slot.startsAt, label: slot.label } : undefined}
            onSlotGone={() => {
              choose('time', null);
              void slots.refetch();
            }}
          />
        </div>
      </div>
    </main>
  );
}

const choiceClass = (checked: boolean, padding: string) =>
  `flex cursor-pointer items-center gap-4 rounded-card border ${padding} transition-colors has-focus-visible:ring-2 has-focus-visible:ring-ring ${
    checked
      ? 'border-primary bg-primary-container'
      : 'border-transparent bg-surface-muted hover:bg-surface-sunken'
  }`;

function Step({
  number,
  title,
  children,
}: Readonly<{ number: number; title: string; children: ReactNode }>) {
  const id = `step-${number}`;
  return (
    <section
      aria-labelledby={id}
      className="flex flex-col gap-6 rounded-panel border border-border-subtle bg-surface p-5 shadow-[0_1px_3px_rgba(31,28,27,0.06)] sm:p-8"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id={id} className="flex items-center gap-3 text-2xl font-medium tracking-tight">
          <span
            aria-hidden="true"
            className="flex size-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
          >
            {number}
          </span>
          {title}
        </h2>
        <span className="text-sm text-muted">{number} of 3</span>
      </div>
      {children}
    </section>
  );
}

function Check({ checked }: Readonly<{ checked: boolean }>) {
  return checked ? (
    <span
      aria-hidden="true"
      className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
    >
      <Icon name="check" size={14} />
    </span>
  ) : (
    <span aria-hidden="true" className="size-6 shrink-0 rounded-full border-2 border-border" />
  );
}

function Waiting({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <p className="rounded-card border border-dashed border-border px-5 py-6 text-muted">
      {children}
    </p>
  );
}

function Skeleton({ rows }: Readonly<{ rows: number }>) {
  return (
    <div role="status" aria-label="Loading" className="flex flex-col gap-3">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-14 animate-pulse rounded-card bg-surface-muted" />
      ))}
    </div>
  );
}

interface Choice {
  id: string;
  name: string;
  price: string;
  durationMinutes: number;
}

/**
 * The booking summary (FSD 2.1 step "details"): what was chosen, then the guest details or a
 * login, notes, and "Pay". Paying creates the booking, which holds the time for 30 minutes,
 * and opens Stripe Checkout (or the demo checkout without Stripe keys).
 */
function Summary({
  slug,
  branchId,
  branchName,
  timeZone,
  service,
  therapist,
  slot,
  onSlotGone,
}: Readonly<{
  slug: string;
  branchId: string | undefined;
  branchName: string;
  timeZone: string;
  service: Choice | undefined;
  therapist: { id: string; displayName: string } | undefined;
  slot: { startsAt: Date; label: string } | undefined;
  onSlotGone: () => void;
}>) {
  const pathname = usePathname();
  const params = useSearchParams();
  const customer = useCustomer();
  const reserve = useReserve();
  const [tab, setTab] = useState<'guest' | 'login'>('guest');
  // One key per visit of this page: a double click or a retry cannot book twice (FSD 5.1).
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const signedIn = customer.data;
  const ready = !!(branchId && service && therapist && slot);
  const here = `${pathname}?${params}`;
  const error = toRequestErrorView(reserve.error, {
    SLOT_TAKEN: 'This time was just taken. Please choose another one.',
  });
  const slotGone = !!error && SLOT_GONE.has(error.code);
  const when =
    slot &&
    `${new Intl.DateTimeFormat('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      timeZone,
    }).format(slot.startsAt)} · ${slot.label}`;

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!ready) return;
    const form = new FormData(event.currentTarget);
    const notes = formText(form, 'notes');
    const phone = formText(form, 'phone');
    reserve.mutate(
      {
        idempotencyKey,
        input: {
          tenantSlug: slug,
          branchId,
          serviceId: service.id,
          staffId: therapist.id,
          startsAt: slot.startsAt,
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
      {
        onSuccess: (created) => window.location.assign(created.checkoutUrl),
        onError: (failure) => {
          const code = toRequestErrorView(failure)?.code;
          if (code && SLOT_GONE.has(code)) onSlotGone();
        },
      },
    );
  };

  const rows: [string, ReactNode][] = [
    ['Service', service ? `${service.name} (${service.durationMinutes} min)` : '—'],
    ['Therapist', therapist?.displayName ?? '—'],
    ['Date & time', when ? <span className="text-primary-text">{when}</span> : '—'],
    ['Branch', branchName || '—'],
  ];

  return (
    <aside
      aria-label="Summary"
      className="flex flex-col gap-6 rounded-panel border border-border-subtle bg-surface p-5 shadow-[0_1px_3px_rgba(31,28,27,0.06)] sm:p-8 lg:sticky lg:top-24"
    >
      <div className="flex items-center justify-between gap-3 border-b border-border-subtle pb-5">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Icon name="timer" size={20} className="text-primary-text" />
          Held 30 min while you pay
        </p>
        <p className="text-3xl font-semibold text-primary-text tabular-nums">
          <span className="sr-only">Total </span>
          {service?.price ?? '—'}
        </p>
      </div>

      <dl className="m-0 flex flex-col gap-3">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-4">
            <dt className="text-muted">{label}</dt>
            <dd className="m-0 text-right">{value}</dd>
          </div>
        ))}
      </dl>

      <form onSubmit={submit} className="flex flex-col gap-4">
        {customer.isPending ? (
          <Skeleton rows={2} />
        ) : signedIn ? (
          <div className="flex flex-col gap-0.5 rounded-card bg-surface-muted px-4 py-3">
            <span className="text-sm text-muted">Booking as</span>
            <span className="font-semibold">{signedIn.name}</span>
            <span className="text-sm text-muted">{signedIn.email}</span>
            {!signedIn.emailVerified && (
              <span className="mt-1 text-sm text-muted">
                Verify your email to see this booking under My bookings later.
              </span>
            )}
          </div>
        ) : (
          <>
            <div
              role="tablist"
              aria-label="How to book"
              className="flex gap-1 rounded-xl bg-surface-muted p-1"
            >
              {(
                [
                  ['guest', 'Guest'],
                  ['login', 'Log in'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  id={`book-tab-${value}`}
                  aria-selected={tab === value}
                  aria-controls="book-panel"
                  onClick={() => setTab(value)}
                  className={`min-h-10 flex-1 rounded-lg text-sm font-semibold ${
                    tab === value
                      ? 'bg-surface shadow-[0_1px_3px_rgba(31,28,27,0.12)]'
                      : 'text-muted hover:text-foreground'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div
              role="tabpanel"
              id="book-panel"
              aria-labelledby={`book-tab-${tab}`}
              className="flex flex-col gap-3"
            >
              {tab === 'guest' ? (
                <>
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
                    hint="We email you a link to manage this booking."
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
                </>
              ) : (
                <div className="flex flex-col gap-3 rounded-card bg-surface-muted p-4">
                  <p className="text-sm text-muted">
                    Log in to keep this booking under My bookings. Your choices stay as they are.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/login?next=${encodeURIComponent(here)}`}
                      className={buttonVariants({ size: 'sm' })}
                    >
                      Log in
                    </Link>
                    <Link
                      href={`/signup?next=${encodeURIComponent(here)}`}
                      className={buttonVariants({ variant: 'secondary', size: 'sm' })}
                    >
                      Create an account
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {(signedIn || tab === 'guest') && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="notes" className="text-sm font-semibold">
              Notes for the therapist (optional)
            </label>
            <textarea
              id="notes"
              name="notes"
              maxLength={500}
              rows={2}
              className="rounded-xl border border-border bg-surface px-3 py-2.5"
            />
          </div>
        )}

        <div aria-live="polite">
          {error && !slotGone && <RequestErrorAlert error={error} />}
          {slotGone && <Alert tone="danger">{error.message}</Alert>}
        </div>

        {(signedIn || tab === 'guest') && (
          <>
            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={!ready || reserve.isPending}
            >
              <Icon name="lock" size={18} />
              {reserve.isPending ? 'Holding your time…' : service ? `Pay ${service.price}` : 'Pay'}
            </Button>
            {!ready && (
              <p className="text-center text-sm text-muted">
                Choose a service, a therapist and a time to continue.
              </p>
            )}
          </>
        )}
      </form>
    </aside>
  );
}
