// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import { Icon } from '@tempora/ui';
import Link from 'next/link';
import { useFeaturedBusinesses } from '@/core/directory/presentation/use-featured-businesses';

const BANNERS = ['bg-primary', 'bg-[#5e8aa0]'];

export function FeaturedBusinesses() {
  const { status, businesses } = useFeaturedBusinesses();

  return (
    <div
      className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-5"
      aria-busy={status === 'loading'}
    >
      {status === 'loading' &&
        [0, 1].map((key) => (
          <div key={key} className="h-[300px] animate-pulse rounded-[20px] bg-surface-muted" />
        ))}

      {status === 'error' && (
        <p role="alert" className="rounded-[20px] bg-danger-soft p-5 text-sm text-danger">
          Businesses could not be loaded. Please try again.
        </p>
      )}

      {businesses.map((business, index) => (
        <Link
          key={business.id}
          href={business.href}
          className="flex flex-col overflow-hidden rounded-[20px] border border-border bg-surface text-foreground no-underline hover:border-primary"
        >
          <div
            aria-hidden="true"
            className={`relative h-[150px] overflow-hidden ${BANNERS[index % BANNERS.length]}`}
          >
            <span className="absolute -top-10 -right-8 size-44 rounded-full bg-white/15" />
            <span className="absolute bottom-[18px] left-5 flex size-14 items-center justify-center rounded-2xl bg-white text-xl font-extrabold text-[#2f5f78]">
              {business.initial}
            </span>
          </div>
          <div className="flex flex-col gap-2.5 p-5">
            <p className="text-[19px] font-extrabold">{business.name}</p>
            <p className="text-sm text-muted">{business.summary}</p>
            <ul className="m-0 flex list-none flex-wrap gap-2 p-0" aria-label="Branches">
              {business.branches.map((branch) => (
                <li
                  key={branch}
                  className="rounded-full bg-surface-muted px-2.5 py-1 text-xs font-semibold text-primary-text"
                >
                  {branch}
                </li>
              ))}
            </ul>
            <p className="mt-1.5 flex items-center gap-1.5 text-sm font-bold text-primary-text">
              Book a session <Icon name="arrow-right" size={16} />
            </p>
          </div>
        </Link>
      ))}

      {status === 'ready' && (
        <Link
          href="/#for-business"
          className="flex flex-col items-start justify-center gap-3 rounded-[20px] border-2 border-dashed border-border p-7 text-foreground no-underline hover:border-primary"
        >
          <Icon name="plus-circle" size={44} className="text-primary-text" strokeWidth={1.6} />
          <p className="text-[19px] font-extrabold">Your business here</p>
          <p className="text-sm leading-relaxed text-muted">
            Take bookings and payments online with a branded booking page.
          </p>
          <p className="text-sm font-bold text-primary-text">List your business →</p>
        </Link>
      )}
    </div>
  );
}
