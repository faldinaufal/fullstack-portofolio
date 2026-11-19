// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import { Alert, buttonVariants, Card, Icon } from '@tempora/ui';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  toBookableDays,
  useBranchPage,
  useBusinessPage,
  useSlots,
} from '@/core/booking/presentation/use-booking';
import { NotFoundPanel, PageShell } from '@/ui/business/page-shell';
import { BookingSteps } from './booking-steps';

/** FSD 2.1 `/[tenant]/book/time`, step 2: a date within the horizon, then a free time. */
export function TimeScreen({ slug }: Readonly<{ slug: string }>) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const branchId = params.get('branch') ?? undefined;
  const serviceId = params.get('service');
  const staffId = params.get('staff');
  const business = useBusinessPage(slug);
  const branch = useBranchPage(slug, branchId);

  const days = toBookableDays(branch.data, business.data);
  const date = params.get('date') ?? days.find((d) => d.open)?.date ?? null;
  const selected = params.get('time');
  const query =
    branchId && serviceId && staffId && date ? { branchId, serviceId, staffId, date } : null;
  const slots = useSlots(slug, query, business.data?.timeZone);

  if (business.isPending || branch.isPending) return <PageShell loading />;
  if (business.isError || branch.isError || !business.data.available || !serviceId || !staffId) {
    return <NotFoundPanel />;
  }

  const service = branch.data.services.find((s) => s.id === serviceId);
  const therapist = branch.data.therapists.find((t) => t.id === staffId);
  if (!service || !therapist) return <NotFoundPanel />;

  const setParam = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value === null) next.delete(key);
      else next.set(key, value);
    }
    router.replace(`${pathname}?${next}`, { scroll: false });
  };
  const chosen = slots.data?.find((slot) => slot.key === selected);

  return (
    <PageShell>
      <BookingSteps businessName={business.data.name} slug={slug} current={1} />

      <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
        <span>
          <span className="block font-extrabold">{service.name}</span>
          <span className="text-sm text-muted">
            {service.duration} · {service.price} · with {therapist.displayName} · {branch.data.name}
          </span>
        </span>
        <Link
          href={`/${slug}/book?branch=${branchId}&service=${serviceId}&staff=${staffId}`}
          className="text-sm font-semibold text-primary-text"
        >
          Change
        </Link>
      </Card>

      <section aria-labelledby="date-title" className="flex flex-col gap-3">
        <h2 id="date-title" className="text-xl font-extrabold">
          Pick a day
        </h2>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2" role="listbox" aria-label="Day">
          {days.map((day) => (
            <button
              key={day.date}
              type="button"
              role="option"
              aria-selected={day.date === date}
              disabled={!day.open}
              onClick={() => setParam({ date: day.date, time: null })}
              className={`flex min-w-[76px] shrink-0 flex-col items-center rounded-xl border-2 px-3 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${
                day.date === date
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-surface'
              }`}
            >
              {day.label}
              {!day.open && <span className="text-[11px] font-normal">Closed</span>}
            </button>
          ))}
        </div>
      </section>

      <section aria-labelledby="time-title" className="flex flex-col gap-3">
        <h2 id="time-title" className="text-xl font-extrabold">
          Pick a time{' '}
          <span className="text-sm font-normal text-muted">({business.data.timeZone})</span>
        </h2>
        {slots.isPending && <div className="h-24 animate-pulse rounded-card bg-surface-muted" />}
        {slots.isError && (
          <Alert tone="danger">Free times could not be loaded. Please try again.</Alert>
        )}
        {slots.data?.length === 0 && (
          <p className="text-sm text-muted">No free times on this day. Try another day.</p>
        )}
        {slots.data && slots.data.length > 0 && (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-2">
            {slots.data.map((slot) => (
              <button
                key={slot.key}
                type="button"
                aria-pressed={slot.key === selected}
                onClick={() => setParam({ time: slot.key })}
                className={`rounded-xl border-2 px-3 py-2.5 font-bold ${
                  slot.key === selected
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-surface hover:border-primary'
                }`}
              >
                {slot.label}
              </button>
            ))}
          </div>
        )}
      </section>

      {chosen && (
        <Card className="flex flex-col gap-3 p-5">
          <p className="font-extrabold">
            {days.find((d) => d.date === date)?.label}, {chosen.label}–{chosen.until} with{' '}
            {therapist.displayName}
          </p>
          <Link
            href={`/${slug}/book/details?${params}`}
            className={buttonVariants({ size: 'lg', className: 'self-start' })}
          >
            Continue to details <Icon name="arrow-right" size={18} />
          </Link>
        </Card>
      )}
    </PageShell>
  );
}
