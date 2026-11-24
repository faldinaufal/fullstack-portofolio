// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import { buttonVariants, Icon } from '@tempora/ui';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

/** Shortcuts into the directory search, which matches business and service names (FSD 5.2). */
const POPULAR = [
  { label: 'Massage', query: 'Massage' },
  { label: 'Physiotherapy', query: 'Physio' },
  { label: 'Deep Tissue', query: 'Deep Tissue' },
  { label: 'Hot Stone', query: 'Hot Stone' },
  { label: 'Dry Needling', query: 'Dry Needling' },
];

/** Hero search, filled with the current query from the URL. */
export function DirectorySearch() {
  return <DirectorySearchForm current={useSearchParams().get('q') ?? ''} />;
}

/**
 * A plain GET form, so it also works before JavaScript loads. Rendered empty on the server
 * (the query is only known in the browser) as the Suspense fallback.
 */
export function DirectorySearchForm({ current }: Readonly<{ current: string }>) {
  return (
    <div className="flex w-full max-w-[680px] flex-col items-center gap-4">
      <form
        role="search"
        action="/#businesses"
        className="flex w-full flex-col gap-2 rounded-panel border border-border-subtle bg-surface p-2 shadow-[0_12px_32px_-12px_rgba(31,28,27,0.18)] sm:flex-row"
      >
        <label className="flex min-h-12 flex-1 items-center gap-2.5 rounded-lg bg-surface-muted px-3.5 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring">
          <Icon name="search" size={18} className="shrink-0 text-accent" />
          <span className="sr-only">Search by business or service</span>
          <input
            key={current}
            name="q"
            type="search"
            defaultValue={current}
            placeholder="Business or service, e.g. Deep Tissue"
            className="h-12 min-w-0 flex-1 border-0 bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted"
          />
        </label>
        <button type="submit" className={buttonVariants({ size: 'lg' })}>
          Find businesses <Icon name="arrow-right" size={18} />
        </button>
      </form>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <span className="text-xs font-bold tracking-wider text-muted uppercase">Popular:</span>
        {POPULAR.map((item) => (
          <Link
            key={item.label}
            href={`/?q=${encodeURIComponent(item.query)}#businesses`}
            aria-current={current === item.query ? 'true' : undefined}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border bg-surface px-3 text-[13px] font-semibold text-foreground no-underline transition-colors hover:border-accent aria-[current]:border-accent aria-[current]:bg-primary-container aria-[current]:text-on-primary-container"
          >
            <span aria-hidden="true" className="size-1.5 rounded-full bg-accent" />
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
