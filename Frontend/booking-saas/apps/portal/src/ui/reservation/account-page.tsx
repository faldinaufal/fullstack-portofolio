// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { useCustomer } from '@/core/account/presentation/use-account';

type Customer = NonNullable<ReturnType<typeof useCustomer>['data']>;

/** Logged-in pages: send visitors to the login page and back. */
export function useRequireCustomer(next: string): Customer | null {
  const router = useRouter();
  const customer = useCustomer();
  useEffect(() => {
    if (customer.isSuccess && customer.data === null) {
      router.replace(`/login?next=${encodeURIComponent(next)}`);
    }
  }, [customer.isSuccess, customer.data, next, router]);
  return customer.data ?? null;
}

/**
 * Column of My bookings and Invoices (Figma `1:1633`, `1:1366`): optional eyebrow, a large
 * title with its description and, on the right, the page's own control (tabs on My bookings).
 * Shows a skeleton until the session is known.
 */
export function AccountPage({
  customer,
  eyebrow,
  title,
  description,
  aside,
  narrow = false,
  children,
}: Readonly<{
  customer: Customer | null;
  eyebrow?: ReactNode;
  title: string;
  description: string;
  aside?: ReactNode;
  /** My bookings is a single column of cards, so it sits in a narrower column. */
  narrow?: boolean;
  children: ReactNode;
}>) {
  return (
    <main className="px-4 py-10 sm:px-6 sm:py-14">
      <div
        className={`mx-auto flex flex-col gap-8 ${narrow ? 'max-w-[1000px]' : 'max-w-[1200px]'}`}
      >
        <div
          className={`flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between ${
            narrow ? 'border-b border-border-subtle pb-5' : ''
          }`}
        >
          <div className="flex min-w-0 flex-col gap-2">
            {eyebrow && (
              <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">{eyebrow}</p>
            )}
            <h1 className="text-[34px] leading-tight font-semibold tracking-tight sm:text-[44px]">
              {title}
            </h1>
            <p className="text-muted sm:text-lg">{description}</p>
          </div>
          {aside && <div className="shrink-0">{aside}</div>}
        </div>
        {customer ? (
          children
        ) : (
          <div
            role="status"
            aria-label="Loading"
            className="h-72 animate-pulse rounded-panel bg-surface-muted"
          />
        )}
      </div>
    </main>
  );
}
