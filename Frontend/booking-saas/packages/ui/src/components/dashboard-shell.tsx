// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import { useCallback, useState, type ComponentType, type ReactNode } from 'react';
import { cn } from '../lib/cn.js';
import { buttonVariants } from './button.js';
import { Drawer } from './drawer.js';
import { Icon, TemporaMark, type IconName } from './icon.js';

/** Any link component with an anchor-like API (Next.js <Link> or a plain <a>). */
export type ShellLink = ComponentType<{
  href: string;
  className?: string;
  children?: ReactNode;
  'aria-current'?: 'page' | 'true' | undefined;
  'aria-label'?: string;
  title?: string;
}>;

export interface ShellNavItem {
  href: string;
  label: string;
  icon: IconName;
  active?: boolean;
}

export interface ShellRailItem {
  href: string;
  label: string;
  /** Short visual label (initials) or an icon. */
  content: { initials: string } | { icon: IconName };
  active?: boolean;
}

export interface DashboardShellProps {
  Link?: ShellLink;
  homeHref: string;
  brand: { title: string; subtitle: string };
  railLabel: string;
  railItems: ShellRailItem[];
  navLabel: string;
  navItems: ShellNavItem[];
  /** Top bar content (search, filters, account). */
  header: ReactNode;
  children: ReactNode;
}

const PlainLink: ShellLink = ({ children, ...props }) => <a {...props}>{children}</a>;

/**
 * Layout shared by Console and Platform Admin (dashboard design): icon rail, coloured
 * sidebar whose active item becomes a tab joined to the page, top bar and content.
 * Below the `lg` breakpoint the rail and sidebar move into a drawer opened from the top bar.
 */
export function DashboardShell({
  Link = PlainLink,
  homeHref,
  brand,
  railLabel,
  railItems,
  navLabel,
  navItems,
  header,
  children,
}: Readonly<DashboardShellProps>) {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const navigation = (
    <ShellNavigation
      Link={Link}
      homeHref={homeHref}
      brand={brand}
      railLabel={railLabel}
      railItems={railItems}
      navLabel={navLabel}
      navItems={navItems}
    />
  );

  return (
    <div className="flex min-h-dvh items-stretch bg-background font-sans text-foreground">
      <div className="hidden w-[300px] shrink-0 lg:flex">{navigation}</div>

      <Drawer open={menuOpen} onClose={closeMenu} label={navLabel} className="flex">
        {navigation}
        <button
          type="button"
          onClick={closeMenu}
          className={buttonVariants({
            variant: 'ghost',
            size: 'icon',
            className: 'absolute top-3 right-3 text-sidebar-foreground hover:bg-white/10',
          })}
        >
          <Icon name="close" />
          <span className="sr-only">Close menu</span>
        </button>
      </Drawer>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3.5 border-b border-border bg-surface px-4 py-3.5 sm:px-7">
          <button
            type="button"
            aria-haspopup="dialog"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
            className={buttonVariants({
              variant: 'secondary',
              size: 'icon',
              className: 'lg:hidden',
            })}
          >
            <Icon name="menu" />
            <span className="sr-only">Open menu</span>
          </button>
          {header}
        </header>
        <main className="flex flex-col gap-[22px] p-4 sm:p-7">{children}</main>
      </div>
    </div>
  );
}

type ShellNavigationProps = Required<
  Pick<
    DashboardShellProps,
    'Link' | 'homeHref' | 'brand' | 'railLabel' | 'railItems' | 'navLabel' | 'navItems'
  >
>;

/** Icon rail plus coloured sidebar; rendered in the page on desktop and in the drawer on mobile. */
function ShellNavigation({
  Link,
  homeHref,
  brand,
  railLabel,
  railItems,
  navLabel,
  navItems,
}: Readonly<ShellNavigationProps>) {
  return (
    <>
      <nav
        aria-label={railLabel}
        className="flex w-[72px] shrink-0 flex-col items-center gap-3.5 border-r border-border bg-rail py-5"
      >
        <Link
          href={homeHref}
          aria-label={`${brand.title} home`}
          className="flex size-11 items-center justify-center rounded-[14px] bg-primary text-primary-foreground"
        >
          <TemporaMark size={24} />
        </Link>
        <span aria-hidden="true" className="h-px w-8 bg-border" />
        {railItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            title={item.label}
            aria-label={item.label}
            aria-current={item.active ? 'true' : undefined}
            className={cn(
              'flex size-11 items-center justify-center rounded-[14px] font-extrabold',
              item.active
                ? 'bg-surface-muted text-primary-text ring-2 ring-primary'
                : 'text-muted hover:bg-surface-muted',
            )}
          >
            {'initials' in item.content ? (
              item.content.initials
            ) : (
              <Icon name={item.content.icon} size={22} />
            )}
          </Link>
        ))}
      </nav>

      <nav aria-label={navLabel} className="flex flex-1 flex-col gap-[18px] bg-sidebar py-6 pl-4">
        <div className="pr-4">
          <p className="text-lg font-extrabold text-sidebar-foreground">{brand.title}</p>
          <p className="mt-0.5 text-[13px] text-sidebar-muted">{brand.subtitle}</p>
        </div>
        <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
          {navItems.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={item.active ? 'page' : undefined}
                className={cn(
                  'flex min-h-11 items-center gap-3 px-4 text-sm no-underline',
                  item.active
                    ? 'rounded-l-xl bg-sidebar-active font-extrabold text-sidebar-active-foreground'
                    : 'mr-4 rounded-xl font-medium text-sidebar-foreground hover:bg-white/10',
                )}
              >
                <Icon name={item.icon} />
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
