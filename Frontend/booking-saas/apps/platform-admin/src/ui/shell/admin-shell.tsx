// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import {
  Alert,
  Badge,
  DashboardShell,
  Icon,
  TemporaMark,
  ThemeToggle,
  type ShellNavItem,
} from '@tempora/ui';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import {
  useAdminSession,
  useStepUpLabel,
  type Admin,
} from '@/core/auth/presentation/use-admin-auth';
import { ApiStatusBadge } from '@/ui/health/api-status-badge';

const NAV: Omit<ShellNavItem, 'active'>[] = [
  { href: '/', label: 'Overview', icon: 'dashboard' },
  { href: '/tenants', label: 'Tenants', icon: 'tenants' },
  { href: '/tenants/new', label: 'Create tenant', icon: 'plus-circle' },
  { href: '/audit', label: 'Platform audit', icon: 'audit' },
  { href: '/account', label: 'Account', icon: 'customers' },
];

function activeHref(pathname: string): string {
  // The most specific matching item wins (/tenants/new over /tenants).
  return (
    NAV.map((item) => item.href)
      .filter((href) => (href === '/' ? pathname === '/' : pathname.startsWith(href)))
      .sort((a, b) => b.length - a.length)[0] ?? ''
  );
}

/**
 * Platform Admin pages need a live session. A convenience for the browser, not the
 * security boundary: every API request checks the session itself (FSD 1.3).
 */
export function AdminFrame({ children }: Readonly<{ children: ReactNode }>) {
  const router = useRouter();
  const session = useAdminSession();
  useEffect(() => {
    if (session.status === 'signed-out') router.replace('/login');
  }, [session.status, router]);

  if (session.status === 'signed-in') {
    return (
      <AdminShell admin={session.admin} initials={session.initials}>
        {children}
      </AdminShell>
    );
  }
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-6">
      {session.status === 'error' ? (
        <Alert tone="danger" title="Tempora cannot be reached">
          Check your connection and reload the page.
        </Alert>
      ) : (
        <p role="status" className="flex items-center gap-3 font-semibold text-muted">
          <TemporaMark className="animate-pulse text-primary-text" /> Loading…
        </p>
      )}
    </div>
  );
}

function AdminShell({
  admin,
  initials,
  children,
}: Readonly<{ admin: Admin; initials: string; children: ReactNode }>) {
  const active = activeHref(usePathname());
  const stepUp = useStepUpLabel(admin);

  return (
    <DashboardShell
      Link={Link}
      homeHref="/"
      brand={{ title: 'Platform Admin', subtitle: 'Tempora operations' }}
      railLabel="Quick links"
      railItems={[
        { href: '/', label: 'Overview', content: { icon: 'dashboard' }, active: active === '/' },
        {
          href: '/tenants',
          label: 'Tenants',
          content: { icon: 'tenants' },
          active: active === '/tenants',
        },
        {
          href: '/audit',
          label: 'Platform audit',
          content: { icon: 'audit' },
          active: active === '/audit',
        },
      ]}
      navLabel="Platform Admin"
      navItems={NAV.map((item) => ({ ...item, active: item.href === active }))}
      header={
        <>
          <span className="text-sm font-semibold text-muted">Tempora operations</span>
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="hidden items-center gap-2.5 md:flex">
              <ApiStatusBadge />
              {/* Step-up status (FSD 6.11): sensitive actions need a code from the last 10 min. */}
              <Badge tone={stepUp.fresh ? 'success' : 'neutral'} className="py-1.5">
                <Icon name="shield" size={14} strokeWidth={2} />
                {stepUp.label}
              </Badge>
            </div>
            <ThemeToggle />
            <Link href="/account" className="flex min-h-11 items-center gap-2.5 rounded-full px-1">
              <span
                aria-hidden="true"
                className="flex size-9 items-center justify-center rounded-full bg-surface-muted text-[13px] font-extrabold text-primary-text"
              >
                {initials}
              </span>
              <span className="hidden sm:block">
                <span className="block text-sm font-bold">{admin.name}</span>
                <span className="block text-xs text-muted">Platform admin</span>
              </span>
            </Link>
          </div>
        </>
      }
    >
      {children}
    </DashboardShell>
  );
}
