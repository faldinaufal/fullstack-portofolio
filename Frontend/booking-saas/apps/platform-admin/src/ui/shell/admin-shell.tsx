// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import {
  Badge,
  DashboardShell,
  Icon,
  SearchField,
  ThemeToggle,
  type ShellNavItem,
} from '@tempora/ui';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { ApiStatusBadge } from '@/ui/health/api-status-badge';

const NAV: Omit<ShellNavItem, 'active'>[] = [
  { href: '/', label: 'Overview', icon: 'dashboard' },
  { href: '/tenants', label: 'Tenants', icon: 'tenants' },
  { href: '/tenants/new', label: 'Create tenant', icon: 'plus-circle' },
  { href: '/support', label: 'Support access', icon: 'shield-check' },
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

/** Platform Admin layout (dashboard design). Demo account until auth exists. */
export function AdminShell({ children }: Readonly<{ children: ReactNode }>) {
  const active = activeHref(usePathname());

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
        { href: '/health', label: 'System health', content: { icon: 'pulse' } },
      ]}
      navLabel="Platform Admin"
      navItems={NAV.map((item) => ({ ...item, active: item.href === active }))}
      header={
        <>
          <SearchField label="Search tenants by name or slug" />
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Secondary status; hidden on phones to keep the top bar to one row. */}
            <div className="hidden items-center gap-2.5 md:flex">
              <ApiStatusBadge />
              <span className="rounded-full border border-dashed border-border px-3 py-1.5 text-xs font-bold text-muted">
                Demo data
              </span>
              {/* Step-up 2FA status (FSD 6.11): sensitive actions need a code from the last 10 min. */}
              <Badge tone="success" className="py-1.5">
                <Icon name="shield" size={14} strokeWidth={2} />
                Code verified 4 min ago
              </Badge>
            </div>
            <ThemeToggle />
            <button
              type="button"
              className="flex min-h-11 items-center gap-2.5 rounded-full px-1 text-left"
            >
              <span
                aria-hidden="true"
                className="flex size-9 items-center justify-center rounded-full bg-surface-muted text-[13px] font-extrabold text-primary-text"
              >
                SO
              </span>
              <span className="hidden sm:block">
                <span className="block text-sm font-bold">Sam O.</span>
                <span className="block text-xs text-muted">Platform admin</span>
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
