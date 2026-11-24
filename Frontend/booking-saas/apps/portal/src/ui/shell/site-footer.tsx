// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { TemporaLogo } from '@tempora/ui';
import Link from 'next/link';
import { ApiStatusBadge } from '@/ui/health/api-status-badge';

/** Links only to Portal screens that exist (DESIGN 4.2). */
const LINKS = [
  { href: '/#businesses', label: 'Businesses' },
  { href: '/#how', label: 'How it works' },
  { href: '/#for-business', label: 'For businesses' },
  { href: '/login', label: 'Log in' },
  { href: '/signup', label: 'Sign up' },
];

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border-subtle bg-surface px-4 py-10 sm:px-6">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-8">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <Link href="/" aria-label="Tempora home" className="self-start">
            <TemporaLogo height={26} />
          </Link>
          <nav aria-label="Footer">
            <ul className="m-0 flex list-none flex-wrap gap-x-6 gap-y-2 p-0 text-sm">
              {LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="inline-flex min-h-11 items-center text-muted hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border-subtle pt-6 text-sm text-muted">
          <p>Portfolio demo · all businesses and data are fictional</p>
          <ApiStatusBadge />
        </div>
      </div>
    </footer>
  );
}
