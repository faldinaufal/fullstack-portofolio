// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import { buttonVariants, Drawer, Icon, TemporaMark, ThemeToggle } from '@tempora/ui';
import Link from 'next/link';
import { useCallback, useState } from 'react';
import { useCustomer } from '@/core/account/presentation/use-account';

const NAV = [
  { href: '/', label: 'Home' },
  { href: '/#businesses', label: 'Businesses' },
  { href: '/#how', label: 'How it works' },
  { href: '/#for-business', label: 'For businesses' },
];

/**
 * Pill navigation inside a brand-coloured band (Portal design). Below the `lg` breakpoint
 * the links and actions move into a drawer opened from a menu button.
 */
export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const customer = useCustomer().data;
  // Logged-in customers go to their bookings; visitors to the login page.
  const account = customer
    ? { href: '/account/bookings', label: customer.name.split(' ')[0] ?? 'My account' }
    : { href: '/login', label: 'Log in' };
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  return (
    <header className="px-4 pt-5 sm:px-6">
      <nav
        aria-label="Main"
        className="mx-auto flex max-w-[1200px] items-center justify-between gap-3 rounded-full bg-primary py-2.5 pr-2.5 pl-5"
      >
        <Link href="/" className="flex items-center gap-2.5 text-lg font-bold text-on-brand">
          <TemporaMark />
          Tempora
        </Link>

        <ul className="m-0 hidden list-none items-center gap-1 p-0 lg:flex">
          {NAV.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="block rounded-full px-3.5 py-2.5 text-sm font-medium text-on-brand-muted hover:bg-white/10 hover:text-on-brand"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="hidden items-center gap-2 lg:flex">
          <ThemeToggle appearance="brand" />
          <Link
            href={account.href}
            className="rounded-full px-4 py-3 text-sm font-semibold text-on-brand hover:bg-white/10"
          >
            {account.label}
          </Link>
          <Link href="/#businesses" className={buttonVariants({ variant: 'inverse' })}>
            Book a session
          </Link>
        </div>

        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(true)}
          className={buttonVariants({
            variant: 'inverse-outline',
            size: 'icon',
            className: 'lg:hidden',
          })}
        >
          <Icon name="menu" />
          <span className="sr-only">Open menu</span>
        </button>
      </nav>

      <Drawer
        open={menuOpen}
        onClose={closeMenu}
        label="Menu"
        side="right"
        className="flex flex-col gap-6 bg-surface p-5"
      >
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2.5 text-lg font-bold text-primary-text">
            <TemporaMark />
            Tempora
          </span>
          <button
            type="button"
            onClick={closeMenu}
            className={buttonVariants({ variant: 'ghost', size: 'icon' })}
          >
            <Icon name="close" />
            <span className="sr-only">Close menu</span>
          </button>
        </div>

        <ul className="m-0 flex list-none flex-col gap-1 p-0">
          {NAV.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="flex min-h-12 items-center rounded-xl px-4 text-base font-semibold text-foreground hover:bg-surface-muted"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="mt-auto flex flex-col gap-3 border-t border-border pt-5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-muted">Theme</span>
            <ThemeToggle />
          </div>
          <Link
            href={account.href}
            className={buttonVariants({ variant: 'secondary', size: 'lg', className: 'w-full' })}
          >
            {account.label}
          </Link>
          <Link href="/#businesses" className={buttonVariants({ size: 'lg', className: 'w-full' })}>
            Book a session
          </Link>
        </div>
      </Drawer>
    </header>
  );
}
