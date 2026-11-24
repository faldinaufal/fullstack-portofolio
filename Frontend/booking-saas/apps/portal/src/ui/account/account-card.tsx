// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import { TemporaMark, TemporaWordmark, ThemeToggle } from '@tempora/ui';
import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * Account pages (log in, sign up, verify email, reset password): no site header or footer,
 * the logo above the card leads back home (Sign In / Create Account designs).
 * `footer` sits in a muted band under the card (`band`) or as a line inside it (`inline`).
 */
export function AccountCard({
  title,
  description,
  children,
  footer,
  footerStyle = 'band',
}: Readonly<{
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  footerStyle?: 'band' | 'inline';
}>) {
  return (
    <main className="relative flex flex-1 flex-col items-center justify-center gap-8 bg-[radial-gradient(ellipse_60%_45%_at_50%_0%,var(--primary-container),transparent)] px-4 py-12 sm:px-6">
      <ThemeToggle className="absolute top-4 right-4" />

      <Link
        href="/"
        aria-label="Tempora home"
        className="group flex flex-col items-center gap-3 rounded-card p-2"
      >
        <span className="flex size-[72px] items-center justify-center rounded-full bg-primary-container transition-transform group-hover:scale-105 motion-reduce:transition-none">
          <TemporaMark size={26} />
        </span>
        <TemporaWordmark height={30} />
        <span className="text-[11px] font-semibold tracking-[0.18em] text-muted uppercase">
          Wellness booking portal
        </span>
      </Link>

      <div className="w-full max-w-[480px] overflow-hidden rounded-panel border border-border-subtle bg-surface shadow-[0_24px_48px_-28px_rgba(31,28,27,0.28)]">
        <div className="flex flex-col gap-7 p-6 sm:p-10">
          <div className="flex flex-col gap-2 text-center">
            <h1 className="text-[28px] leading-tight font-semibold tracking-tight sm:text-[32px]">
              {title}
            </h1>
            {description && <p className="leading-relaxed text-muted">{description}</p>}
          </div>
          {children}
          {footer && footerStyle === 'inline' && (
            <p className="text-center text-sm text-muted">{footer}</p>
          )}
        </div>
        {footer && footerStyle === 'band' && (
          <p className="border-t border-border-subtle bg-surface-muted px-6 py-5 text-center text-sm text-muted">
            {footer}
          </p>
        )}
      </div>
    </main>
  );
}
