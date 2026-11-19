// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import { Badge, buttonVariants, Card, Icon } from '@tempora/ui';
import Link from 'next/link';
import { useBranchPage } from '@/core/booking/presentation/use-booking';
import { NotFoundPanel, PageShell } from './page-shell';

/** FSD 2.1 Branch page: details, therapists and the services offered here. */
export function BranchScreen({ slug, branchId }: Readonly<{ slug: string; branchId: string }>) {
  const branch = useBranchPage(slug, branchId);

  if (branch.isPending) return <PageShell loading />;
  if (branch.isError) return <NotFoundPanel />;
  const page = branch.data;
  const serviceName = new Map(page.services.map((s) => [s.id, s.name]));

  return (
    <PageShell>
      <Link
        href={`/${slug}`}
        className="flex items-center gap-1.5 text-sm font-semibold text-primary-text"
      >
        <Icon name="chevron-left" size={16} /> {page.business.name}
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[32px] leading-tight font-extrabold">{page.name}</h1>
          {page.address && <p className="text-muted">{page.address}</p>}
          <p className="text-sm text-muted">{page.hours}</p>
          {page.phone && <p className="text-sm text-muted">{page.phone}</p>}
        </div>
        {page.business.available && (
          <Link href={`/${slug}/book?branch=${page.id}`} className={buttonVariants({ size: 'lg' })}>
            Book at {page.name}
          </Link>
        )}
      </div>

      <section aria-labelledby="therapists-title" className="flex flex-col gap-4">
        <h2 id="therapists-title" className="text-2xl font-extrabold">
          Therapists
        </h2>
        <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4 p-0">
          {page.therapists.map((therapist) => (
            <li key={therapist.id}>
              <Card className="flex h-full flex-col gap-3 p-5">
                <span className="flex items-center gap-3">
                  <span className="flex size-11 items-center justify-center rounded-full bg-surface-muted font-extrabold text-primary-text">
                    {therapist.displayName.charAt(0)}
                  </span>
                  <span className="text-base font-extrabold">{therapist.displayName}</span>
                </span>
                <span className="flex flex-wrap gap-1.5">
                  {therapist.serviceIds.map((id) => (
                    <Badge key={id} tone="info">
                      {serviceName.get(id)}
                    </Badge>
                  ))}
                </span>
              </Card>
            </li>
          ))}
        </ul>
      </section>
    </PageShell>
  );
}
