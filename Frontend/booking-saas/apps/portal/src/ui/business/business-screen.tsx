// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import { Alert, buttonVariants, Card, Icon } from '@tempora/ui';
import Link from 'next/link';
import { useBusinessPage } from '@/core/booking/presentation/use-booking';
import { NotFoundPanel, PageShell } from './page-shell';

/** FSD 2.1 Business page `/[tenant]`: branches with hours, services with prices. */
export function BusinessScreen({ slug }: Readonly<{ slug: string }>) {
  const business = useBusinessPage(slug);

  if (business.isPending) return <PageShell loading />;
  if (business.isError) return <NotFoundPanel />;
  const page = business.data;

  return (
    <PageShell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="flex size-16 items-center justify-center rounded-2xl bg-primary text-2xl font-extrabold text-primary-foreground">
            {page.name.charAt(0)}
          </span>
          <div>
            <h1 className="text-[32px] leading-tight font-extrabold">{page.name}</h1>
            <p className="text-muted">
              {page.branches.length} {page.branches.length === 1 ? 'branch' : 'branches'} ·{' '}
              {page.services.length} {page.services.length === 1 ? 'service' : 'services'}
            </p>
          </div>
        </div>
        {page.available && (
          <Link href={`/${slug}/book`} className={buttonVariants({ size: 'lg' })}>
            Book a session <Icon name="arrow-right" size={18} />
          </Link>
        )}
      </div>

      {!page.available && (
        <Alert tone="info" title="Temporarily unavailable">
          This business is not taking bookings at the moment. Please check back later.
        </Alert>
      )}

      <section aria-labelledby="services-title" className="flex flex-col gap-4">
        <h2 id="services-title" className="text-2xl font-extrabold">
          Services
        </h2>
        <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4 p-0">
          {page.services.map((service) => (
            <li key={service.id}>
              <Card className="flex h-full flex-col gap-2 p-5">
                <span className="flex items-start justify-between gap-3">
                  <span className="text-lg font-extrabold">{service.name}</span>
                  <span className="text-lg font-extrabold text-primary-text">{service.price}</span>
                </span>
                <span className="flex items-center gap-1.5 text-sm text-muted">
                  <Icon name="clock" size={16} /> {service.duration}
                </span>
                {service.description && <span className="text-sm">{service.description}</span>}
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="branches-title" className="flex flex-col gap-4">
        <h2 id="branches-title" className="text-2xl font-extrabold">
          Branches
        </h2>
        <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4 p-0">
          {page.branches.map((branch) => (
            <li key={branch.id}>
              <Link
                href={`/${slug}/branches/${branch.id}`}
                className="flex h-full flex-col gap-2 rounded-card border border-border bg-surface p-5 text-foreground no-underline hover:border-primary"
              >
                <span className="text-lg font-extrabold">{branch.name}</span>
                {branch.address && (
                  <span className="flex items-center gap-1.5 text-sm text-muted">
                    <Icon name="map-pin" size={16} /> {branch.address}
                  </span>
                )}
                <span className="flex items-center gap-1.5 text-sm text-muted">
                  <Icon name="clock" size={16} /> {branch.hours}
                </span>
                {branch.closures[0] && (
                  <span className="text-[13px] font-semibold text-warning">
                    Closed {branch.closures[0].startsOn}
                    {branch.closures[0].endsOn !== branch.closures[0].startsOn &&
                      ` – ${branch.closures[0].endsOn}`}{' '}
                    ({branch.closures[0].reason})
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </PageShell>
  );
}
