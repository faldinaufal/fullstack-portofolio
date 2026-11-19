// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import { buttonVariants, Icon } from '@tempora/ui';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { ReactNode } from 'react';
import { useBranchPage, useBusinessPage } from '@/core/booking/presentation/use-booking';
import { NotFoundPanel, PageShell } from '@/ui/business/page-shell';
import { BookingSteps } from './booking-steps';

/**
 * FSD 2.1 `/[tenant]/book`, step 1: branch → service → therapist. The choices live in the URL,
 * so the page can be reloaded or shared without losing them.
 */
export function ChooseScreen({ slug }: Readonly<{ slug: string }>) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const business = useBusinessPage(slug);
  const branchId = params.get('branch') ?? undefined;
  const serviceId = params.get('service') ?? undefined;
  const staffId = params.get('staff') ?? undefined;
  const branch = useBranchPage(slug, branchId);

  if (business.isPending) return <PageShell loading />;
  if (business.isError || !business.data.available) return <NotFoundPanel />;

  /** Changing an earlier choice clears the later ones. */
  const choose = (next: { branch?: string; service?: string; staff?: string }) => {
    const query = new URLSearchParams(
      Object.entries(next).filter(([, v]) => v) as [string, string][],
    );
    router.replace(`${pathname}?${query}`, { scroll: false });
  };

  const services = branch.data?.services ?? [];
  const therapists = serviceId && branch.data ? branch.data.therapistsFor(serviceId) : [];
  const ready = branchId && serviceId && staffId && therapists.some((t) => t.id === staffId);

  return (
    <PageShell>
      <BookingSteps businessName={business.data.name} slug={slug} current={0} />

      <Choice title="Where?" legend="Branch">
        {business.data.branches.map((b) => (
          <Option
            key={b.id}
            name="branch"
            checked={b.id === branchId}
            onChange={() => choose({ branch: b.id })}
            title={b.name}
            detail={b.address ?? b.hours}
          />
        ))}
      </Choice>

      {branchId && (
        <Choice title="What?" legend="Service">
          {branch.isPending && <p className="text-sm text-muted">Loading services…</p>}
          {services.map((s) => (
            <Option
              key={s.id}
              name="service"
              checked={s.id === serviceId}
              onChange={() => choose({ branch: branchId, service: s.id })}
              title={s.name}
              detail={`${s.duration} · ${s.price}`}
            />
          ))}
        </Choice>
      )}

      {serviceId && branch.data && (
        <Choice title="With whom?" legend="Therapist">
          {therapists.map((t) => (
            <Option
              key={t.id}
              name="staff"
              checked={t.id === staffId}
              onChange={() => choose({ branch: branchId, service: serviceId, staff: t.id })}
              title={t.displayName}
            />
          ))}
        </Choice>
      )}

      <div>
        {ready ? (
          <Link
            href={`/${slug}/book/time?branch=${branchId}&service=${serviceId}&staff=${staffId}`}
            className={buttonVariants({ size: 'lg' })}
          >
            Choose a time <Icon name="arrow-right" size={18} />
          </Link>
        ) : (
          <p className="text-sm text-muted">
            Pick a branch, a service and a therapist to see free times.
          </p>
        )}
      </div>
    </PageShell>
  );
}

function Choice({
  title,
  legend,
  children,
}: Readonly<{ title: string; legend: string; children: ReactNode }>) {
  return (
    <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
      <legend className="mb-3 text-xl font-extrabold">
        {title} <span className="sr-only">({legend})</span>
      </legend>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">{children}</div>
    </fieldset>
  );
}

function Option({
  name,
  checked,
  onChange,
  title,
  detail,
}: Readonly<{
  name: string;
  checked: boolean;
  onChange: () => void;
  title: string;
  detail?: string;
}>) {
  return (
    <label
      className={`flex cursor-pointer flex-col gap-1 rounded-card border-2 bg-surface p-4 ${
        checked ? 'border-primary' : 'border-border hover:border-primary/50'
      }`}
    >
      <input type="radio" name={name} checked={checked} onChange={onChange} className="sr-only" />
      <span className="flex items-center justify-between gap-2 font-extrabold">
        {title}
        {checked && <Icon name="check" size={18} className="text-primary-text" />}
      </span>
      {detail && <span className="text-sm text-muted">{detail}</span>}
    </label>
  );
}
