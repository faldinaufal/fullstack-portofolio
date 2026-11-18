// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import {
  Button,
  DashboardShell,
  Icon,
  SearchField,
  ThemeToggle,
  type ShellNavItem,
} from '@tempora/ui';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import type { SessionViewModel } from '@/core/auth/presentation/session.view-model';
import { useLogout } from '@/core/auth/presentation/use-auth';
import { ApiStatusBadge } from '@/ui/health/api-status-badge';

const NAV: Omit<ShellNavItem, 'active'>[] = [
  { href: '/', label: 'Dashboard', icon: 'dashboard' },
  { href: '/calendar', label: 'Calendar', icon: 'calendar' },
  { href: '/bookings', label: 'Bookings', icon: 'bookings' },
  { href: '/customers', label: 'Customers', icon: 'customers' },
  { href: '/invoices', label: 'Invoices', icon: 'invoices' },
  { href: '/branches', label: 'Branches', icon: 'branches' },
  { href: '/services', label: 'Services', icon: 'services' },
  { href: '/team', label: 'Team', icon: 'team' },
  { href: '/audit', label: 'Audit log', icon: 'audit' },
  { href: '/emails', label: 'Email log', icon: 'emails' },
  { href: '/settings', label: 'Settings', icon: 'settings' },
];

function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname.startsWith(href);
}

/**
 * Console layout (dashboard design) for the signed-in account. The rail lists the
 * businesses the account belongs to (FSD 1.1: memberships); switching is a later milestone.
 */
export function ConsoleShell({
  session,
  children,
}: Readonly<{ session: SessionViewModel; children: ReactNode }>) {
  const pathname = usePathname();
  const router = useRouter();
  const logout = useLogout();

  return (
    <DashboardShell
      Link={Link}
      homeHref="/"
      brand={{ title: session.tenantName, subtitle: session.subtitle }}
      railLabel="Businesses"
      railItems={session.businesses.map((business) => ({
        href: '/',
        label: business.active ? `${business.name} (current)` : business.name,
        content: { initials: business.initial },
        active: business.active,
      }))}
      navLabel="Console"
      navItems={NAV.map((item) => ({ ...item, active: isActive(pathname, item.href) }))}
      header={
        <>
          <SearchField label="Search bookings, customers, invoices" />
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Secondary status; hidden on phones to keep the top bar to one row. */}
            <div className="hidden items-center gap-2.5 md:flex">
              <ApiStatusBadge />
              <span className="rounded-full border border-dashed border-border px-3 py-1.5 text-xs font-bold text-muted">
                Demo data
              </span>
            </div>
            <label className="flex items-center gap-2 text-[13px] text-muted">
              <span className="sr-only sm:not-sr-only">Branch</span>
              <select className="h-10 rounded-[10px] border border-border bg-surface px-2.5 text-sm font-semibold text-foreground">
                <option>All branches</option>
                <option>Downtown</option>
                <option>Riverside</option>
                <option>Northgate</option>
              </select>
            </label>
            <ThemeToggle />
            <div className="flex min-h-11 items-center gap-2.5 px-1" title={session.email}>
              <span
                aria-hidden="true"
                className="flex size-9 items-center justify-center rounded-full bg-surface-muted text-[13px] font-extrabold text-primary-text"
              >
                {session.initials}
              </span>
              <span className="hidden sm:block">
                <span className="block text-sm font-bold">{session.shortName}</span>
                <span className="block text-xs text-muted">{session.roleLabel}</span>
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              title="Log out"
              disabled={logout.isPending}
              onClick={() =>
                logout.mutate(undefined, { onSettled: () => router.replace('/login') })
              }
            >
              <Icon name="logout" />
              <span className="sr-only">Log out</span>
            </Button>
          </div>
        </>
      }
    >
      {children}
    </DashboardShell>
  );
}
