// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { buttonVariants } from '@tempora/ui';
import Link from 'next/link';
import { SiteFooter } from '@/ui/shell/site-footer';
import { SiteHeader } from '@/ui/shell/site-header';

/** Root 404: outside the (site) group, so it adds the header and footer itself. */
export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-[640px] flex-col items-start gap-4 px-4 py-24 sm:px-6">
        <p className="text-sm font-bold text-primary-text">404</p>
        <h1 className="text-3xl font-extrabold">This page does not exist yet</h1>
        <p className="text-muted">
          Tempora is being built screen by screen. This page is part of a later milestone.
        </p>
        <Link href="/" className={buttonVariants()}>
          Back to home
        </Link>
      </main>
      <SiteFooter />
    </>
  );
}
