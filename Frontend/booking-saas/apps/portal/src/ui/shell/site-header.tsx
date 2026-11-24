// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import { buttonVariants, Drawer, Icon, TemporaLogo, ThemeToggle } from '@tempora/ui';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useCustomer, useLogout } from '@/core/account/presentation/use-account';

interface NavItem {
  href: string;
  label: string;
}

/** Visitors: sections of the home page. */
const GUEST_NAV: NavItem[] = [
  { href: '/', label: 'Home' },
  { href: '/#businesses', label: 'Businesses' },
  { href: '/#how', label: 'How it works' },
  { href: '/#for-business', label: 'For businesses' },
];

/** Logged-in customers: the directory and their own pages (FSD 2.1). */
const CUSTOMER_NAV: NavItem[] = [
  { href: '/#businesses', label: 'Explore' },
  { href: '/account/bookings', label: 'My bookings' },
  { href: '/account/invoices', label: 'Invoices' },
];

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join('');

/**
 * Top navigation (Portal shell, DESIGN 3): logo, links and the account action on a light bar
 * that stays at the top. Logged in, the links become Explore / My bookings / Invoices and the
 * account opens a small menu. Below `lg` everything moves into a drawer.
 */
export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const customer = useCustomer().data;
  const pathname = usePathname();
  const nav = customer ? CUSTOMER_NAV : GUEST_NAV;
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  // Only real pages are "current"; home-page anchors never are.
  const current = (href: string) => (href.includes('#') ? false : pathname.startsWith(href));
  const isCurrent = (href: string) => (href === '/' ? pathname === '/' : current(href));

  return (
    <header className="sticky top-0 z-40 border-b border-border-subtle bg-background/85 px-4 backdrop-blur-md sm:px-6">
      <nav
        aria-label="Main"
        className="mx-auto flex h-16 max-w-[1200px] items-center justify-between gap-3"
      >
        <Link href="/" className="flex min-h-11 items-center" aria-label="Tempora home">
          <TemporaLogo height={30} />
        </Link>

        <ul className="m-0 hidden list-none items-center gap-1 p-0 lg:flex">
          {nav.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isCurrent(item.href) ? 'page' : undefined}
                className="block rounded-lg px-3.5 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-surface-muted hover:text-foreground aria-[current=page]:bg-primary-container aria-[current=page]:text-on-primary-container"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="hidden items-center gap-2 lg:flex">
          <ThemeToggle />
          {customer ? (
            <AccountMenu name={customer.name} email={customer.email} />
          ) : (
            <>
              <Link href="/login" className={buttonVariants({ variant: 'ghost' })}>
                Log in
              </Link>
              <Link href="/#businesses" className={buttonVariants()}>
                Book a session
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(true)}
          className={buttonVariants({ variant: 'secondary', size: 'icon', className: 'lg:hidden' })}
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
          <TemporaLogo height={26} />
          <button
            type="button"
            onClick={closeMenu}
            className={buttonVariants({ variant: 'ghost', size: 'icon' })}
          >
            <Icon name="close" />
            <span className="sr-only">Close menu</span>
          </button>
        </div>

        {customer && (
          <div className="flex items-center gap-3 rounded-card bg-surface-muted p-3">
            <Avatar name={customer.name} />
            <span className="min-w-0">
              <span className="block truncate font-semibold">{customer.name}</span>
              <span className="block truncate text-sm text-muted">{customer.email}</span>
            </span>
          </div>
        )}

        <ul className="m-0 flex list-none flex-col gap-1 p-0">
          {[
            ...nav,
            ...(customer ? [{ href: '/account/profile', label: 'Profile and security' }] : []),
          ].map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={closeMenu}
                aria-current={isCurrent(item.href) ? 'page' : undefined}
                className="flex min-h-12 items-center rounded-xl px-4 text-base font-semibold text-foreground hover:bg-surface-muted aria-[current=page]:bg-primary-container aria-[current=page]:text-on-primary-container"
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
          {customer ? (
            <LogoutButton
              className={buttonVariants({ variant: 'secondary', size: 'lg', className: 'w-full' })}
            />
          ) : (
            <>
              <Link
                href="/login"
                className={buttonVariants({
                  variant: 'secondary',
                  size: 'lg',
                  className: 'w-full',
                })}
              >
                Log in
              </Link>
              <Link
                href="/#businesses"
                className={buttonVariants({ size: 'lg', className: 'w-full' })}
              >
                Book a session
              </Link>
            </>
          )}
        </div>
      </Drawer>
    </header>
  );
}

function Avatar({ name }: Readonly<{ name: string }>) {
  return (
    <span
      aria-hidden="true"
      className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-container text-sm font-semibold text-on-primary-container"
    >
      {initialsOf(name)}
    </span>
  );
}

function LogoutButton({ className }: Readonly<{ className: string }>) {
  const router = useRouter();
  const logout = useLogout();
  return (
    <button
      type="button"
      className={className}
      disabled={logout.isPending}
      onClick={() => logout.mutate(undefined, { onSuccess: () => router.push('/') })}
    >
      <Icon name="logout" size={18} />
      {logout.isPending ? 'Logging out…' : 'Log out'}
    </button>
  );
}

/**
 * Disclosure menu (button + list of links), not an ARIA `menu`: plain links keep normal
 * keyboard behaviour. Closes on Escape, on a click outside and after choosing an item.
 */
function AccountMenu({ name, email }: Readonly<{ name: string; email: string }>) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const close = () => setOpen(false);
  const item =
    'flex min-h-11 w-full items-center gap-2.5 rounded-lg px-3 text-sm font-medium text-foreground hover:bg-surface-muted';

  return (
    <div ref={root} className="relative">
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
        className="flex min-h-11 items-center gap-2 rounded-full py-1 pr-2 pl-1 hover:bg-surface-muted"
      >
        <Avatar name={name} />
        <span className="max-w-32 truncate text-sm font-semibold">{name.split(' ')[0]}</span>
        <Icon name="chevron-down" size={16} />
        <span className="sr-only">Account menu</span>
      </button>
      {open && (
        <div
          id={id}
          className="absolute top-full right-0 mt-2 w-64 rounded-card border border-border-subtle bg-surface p-2 shadow-[0_16px_40px_-16px_rgba(31,28,27,0.3)]"
        >
          <div className="border-b border-border-subtle px-3 pt-2 pb-3">
            <p className="truncate font-semibold">{name}</p>
            <p className="truncate text-sm text-muted">{email}</p>
          </div>
          <ul className="m-0 flex list-none flex-col gap-0.5 p-0 pt-2">
            <li>
              <Link href="/account/profile" onClick={close} className={item}>
                <Icon name="user" size={18} /> Profile and security
              </Link>
            </li>
            <li>
              <LogoutButton className={item} />
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
