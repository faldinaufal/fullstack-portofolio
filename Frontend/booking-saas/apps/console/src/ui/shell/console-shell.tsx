'use client';

import { DashboardShell, SearchField, ThemeToggle, type ShellNavItem } from '@tempora/ui';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
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
 * Console layout (dashboard design). The rail switches between the businesses the
 * signed-in team account belongs to (FSD 1.1: memberships). Demo account until auth exists.
 */
export function ConsoleShell({ children }: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname();

  return (
    <DashboardShell
      Link={Link}
      homeHref="/"
      brand={{ title: 'Lumen Wellness', subtitle: 'Owner · all branches' }}
      railLabel="Businesses"
      railItems={[
        {
          href: '/',
          label: 'Lumen Wellness Studio (current)',
          content: { initials: 'L' },
          active: true,
        },
        {
          href: '/switch/harbor-physio',
          label: 'Switch to Harbor Physio Clinic',
          content: { initials: 'H' },
        },
      ]}
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
            <button
              type="button"
              className="flex min-h-11 items-center gap-2.5 rounded-full px-1 text-left"
            >
              <span
                aria-hidden="true"
                className="flex size-9 items-center justify-center rounded-full bg-surface-muted text-[13px] font-extrabold text-primary-text"
              >
                MR
              </span>
              <span className="hidden sm:block">
                <span className="block text-sm font-bold">Maya R.</span>
                <span className="block text-xs text-muted">Owner</span>
              </span>
            </button>
          </div>
        </>
      }
    >
      {children}
    </DashboardShell>
  );
}
