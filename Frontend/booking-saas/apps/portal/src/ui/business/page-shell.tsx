// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { buttonVariants } from '@tempora/ui';
import Link from 'next/link';
import type { ReactNode } from 'react';

/** Content column of the business and booking pages, with a loading skeleton. */
export function PageShell({
  children,
  loading = false,
}: Readonly<{ children?: ReactNode; loading?: boolean }>) {
  return (
    <main className="px-4 py-10 sm:px-6">
      <div className="mx-auto flex max-w-[1100px] flex-col gap-8">
        {loading ? (
          <div role="status" aria-label="Loading" className="flex flex-col gap-4">
            <div className="h-16 w-2/3 animate-pulse rounded-2xl bg-surface-muted" />
            <div className="h-48 animate-pulse rounded-card bg-surface-muted" />
          </div>
        ) : (
          children
        )}
      </div>
    </main>
  );
}

/** Unknown slug, not set up yet, or another business's record. */
export function NotFoundPanel() {
  return (
    <PageShell>
      <div className="flex flex-col items-start gap-4 py-10">
        <p className="text-sm font-bold text-primary-text">404</p>
        <h1 className="text-3xl font-extrabold">We could not find this page</h1>
        <p className="text-muted">The business may have moved or is not taking bookings yet.</p>
        <Link href="/#businesses" className={buttonVariants()}>
          Browse businesses
        </Link>
      </div>
    </PageShell>
  );
}
