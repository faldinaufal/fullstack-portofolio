// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import {
  Alert,
  Button,
  DashboardShell,
  Icon,
  SearchField,
  Select,
  ThemeToggle,
  type ShellNavItem,
} from '@tempora/ui';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import type { SessionViewModel } from '@/core/auth/presentation/session.view-model';
import { useLogout } from '@/core/auth/presentation/use-auth';
import { ApiStatusBadge } from '@/ui/health/api-status-badge';

type Role = SessionViewModel['role'];
const ALL: Role[] = ['owner', 'manager', 'staff'];
const LEADS: Role[] = ['owner', 'manager'];

/** Sidebar entries and who sees them (FSD 2.2: the sidebar shows only what the role may use). */
/** Header branch picker: still demo data, like the "Demo data" badge beside it. */
const DEMO_BRANCHES = ['All branches', 'Downtown', 'Riverside', 'Northgate'].map((name) => ({
  value: name,
  label: name,
}));

const NAV: (Omit<ShellNavItem, 'active'> & { roles: Role[] })[] = [
  { href: '/', label: 'Dashboard', icon: 'dashboard', roles: ALL },
  { href: '/calendar', label: 'Calendar', icon: 'calendar', roles: ALL },
  { href: '/schedule', label: 'My schedule', icon: 'clock', roles: ['staff'] },
  { href: '/bookings', label: 'Bookings', icon: 'bookings', roles: LEADS },
  { href: '/customers', label: 'Customers', icon: 'customers', roles: LEADS },
  { href: '/invoices', label: 'Invoices', icon: 'invoices', roles: LEADS },
  { href: '/branches', label: 'Branches', icon: 'branches', roles: LEADS },
  { href: '/services', label: 'Services', icon: 'services', roles: LEADS },
  { href: '/team', label: 'Team', icon: 'team', roles: LEADS },
  { href: '/audit', label: 'Audit log', icon: 'audit', roles: LEADS },
  { href: '/emails', label: 'Email log', icon: 'emails', roles: LEADS },
  { href: '/settings', label: 'Settings', icon: 'settings', roles: ['owner'] },
];

function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname.startsWith(href);
}

/**
 * Console layout (dashboard design) for the signed-in account. The rail lists the
 * businesses the account belongs to (FSD 1.1: memberships); choosing one switches the session.
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
        href: business.active ? '/' : `/switch/${business.id}`,
        label: business.active ? `${business.name} (current)` : `Switch to ${business.name}`,
        content: { initials: business.initial },
        active: business.active,
      }))}
      navLabel="Console"
      navItems={NAV.filter((item) => item.roles.includes(session.role)).map(
        ({ roles: _roles, ...item }) => ({
          ...item,
          active: isActive(pathname, item.href),
        }),
      )}
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
            <Select
              label="Branch"
              options={DEMO_BRANCHES}
              className="flex-row items-center gap-2"
              labelClassName="sr-only text-[13px] font-normal text-muted sm:not-sr-only"
              triggerClassName="h-10 w-auto min-w-[150px] rounded-[10px] px-2.5 text-sm font-semibold"
            />
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
      {session.suspension && (
        <Alert tone="danger" title={`${session.tenantName} is suspended`}>
          {session.suspension.reason} Customers cannot book, and the Console is read only until
          Tempora reactivates the business. Reply to the email you received to resolve it.
        </Alert>
      )}
      {children}
    </DashboardShell>
  );
}
