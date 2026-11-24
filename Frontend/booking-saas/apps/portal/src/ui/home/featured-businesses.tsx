// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import { BusinessLogo, buttonVariants, Icon } from '@tempora/ui';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { BusinessCardViewModel } from '@/core/directory/presentation/featured-businesses.view-model';
import { useFeaturedBusinesses } from '@/core/directory/presentation/use-featured-businesses';

/** Directory results: every active business, or those matching the hero search. */
export function FeaturedBusinesses() {
  const search = useSearchParams().get('q')?.trim() || undefined;
  const { status, businesses } = useFeaturedBusinesses(search);

  return (
    <div className="flex flex-col gap-5">
      {search && (
        <p
          className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted"
          aria-live="polite"
        >
          {status === 'ready' && (
            <span>
              {businesses.length} {businesses.length === 1 ? 'result' : 'results'} for “{search}”
            </span>
          )}
          <Link href="/#businesses" className="font-semibold text-primary-text">
            Clear search
          </Link>
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-2" aria-busy={status === 'loading'}>
        {status === 'loading' &&
          [0, 1].map((key) => (
            <div key={key} className="h-[300px] animate-pulse rounded-panel bg-surface-muted" />
          ))}

        {status === 'error' && (
          <p
            role="alert"
            className="rounded-panel bg-danger-soft p-5 text-sm text-danger lg:col-span-2"
          >
            Businesses could not be loaded. Please try again.
          </p>
        )}

        {businesses.map((business) => (
          <BusinessCard key={business.id} business={business} />
        ))}

        {status === 'ready' && businesses.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-panel border border-dashed border-border p-10 text-center lg:col-span-2">
            <Icon name="search" size={28} className="text-accent" />
            <p className="font-bold">
              {search ? `No business matches “${search}”` : 'No businesses are taking bookings yet'}
            </p>
            <p className="text-sm text-muted">
              {search
                ? 'Try another service, such as massage or physiotherapy.'
                : 'Please check back soon.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function BusinessCard({ business }: Readonly<{ business: BusinessCardViewModel }>) {
  const titleId = `business-${business.id}`;
  return (
    <article
      aria-labelledby={titleId}
      className="flex flex-col gap-5 rounded-panel border border-border-subtle bg-surface p-5 shadow-[0_1px_2px_rgba(31,28,27,0.04)] transition-shadow hover:shadow-[0_12px_32px_-14px_rgba(31,28,27,0.22)] sm:p-6"
    >
      <div className="flex items-start gap-4">
        {/* The owner's logo, or the initials when none is uploaded (FSD 6.15). */}
        <BusinessLogo name={business.name} url={business.logoUrl} className="size-14 text-lg" />
        <div className="min-w-0">
          <h3 id={titleId} className="text-xl font-bold tracking-tight">
            {business.name}
          </h3>
          <p className="mt-1 text-sm text-muted">{business.summary}</p>
        </div>
      </div>

      <p className="inline-flex items-center gap-1.5 self-start rounded-md bg-surface-muted px-2.5 py-1.5 text-xs font-semibold">
        <Icon name="map-pin" size={14} className="shrink-0 text-accent" />
        {business.branchLabel}
      </p>

      <div className="rounded-card bg-surface-muted p-4">
        <p className="text-[11px] font-bold tracking-wider text-primary-text uppercase">Services</p>
        <ul className="m-0 mt-2.5 flex list-none flex-wrap gap-2 p-0">
          {business.services.map((service) => (
            <li
              key={service}
              className="rounded-md border border-border-subtle bg-surface px-2.5 py-1 text-[13px] font-medium"
            >
              {service}
            </li>
          ))}
          {business.moreServices > 0 && (
            <li className="px-1 py-1 text-[13px] font-medium text-muted">
              +{business.moreServices} more
            </li>
          )}
        </ul>
      </div>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-1">
        <Link
          href={business.href}
          className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-foreground hover:text-primary-text"
        >
          {business.branchLink}
          <Icon name="chevron-right" size={16} />
          <span className="sr-only"> of {business.name}</span>
        </Link>
        <Link href={business.bookHref} className={buttonVariants()}>
          <Icon name="calendar" size={18} />
          Book session
          <span className="sr-only"> at {business.name}</span>
        </Link>
      </div>
    </article>
  );
}
