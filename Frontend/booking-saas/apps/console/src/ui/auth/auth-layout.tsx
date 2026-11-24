// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { Icon, TemporaMark, ThemeToggle, type IconName } from '@tempora/ui';
import type { ReactNode } from 'react';

const POINTS: { icon: IconName; text: string }[] = [
  { icon: 'calendar-check', text: 'Bookings that can never overlap' },
  { icon: 'invoices', text: 'Invoices numbered and paid online' },
  { icon: 'shield-check', text: 'Every login confirmed with an email code' },
];

/**
 * Frame for the sign-in screens: brand panel on wide screens, form card on the right.
 * On phones the panel collapses into a small header above the form.
 */
export function AuthLayout({
  title,
  description,
  children,
  footer,
}: Readonly<{ title: string; description?: ReactNode; children: ReactNode; footer?: ReactNode }>) {
  return (
    <div className="flex min-h-dvh bg-background">
      <aside className="relative hidden w-[44%] max-w-[560px] flex-col justify-between overflow-hidden bg-primary p-12 text-on-brand lg:flex">
        <span
          aria-hidden="true"
          className="absolute -right-24 -bottom-24 size-[420px] rounded-full bg-white/10"
        />
        <p className="flex items-center gap-2.5 text-xl font-bold">
          <span className="flex size-10 items-center justify-center rounded-xl bg-white">
            <TemporaMark size={18} />
          </span>
          Tempora Console
        </p>
        <div className="relative flex flex-col gap-6">
          <p className="text-[34px] leading-tight font-extrabold">
            Run every branch of your studio or clinic from one place.
          </p>
          <ul className="m-0 flex list-none flex-col gap-3.5 p-0">
            {POINTS.map((point) => (
              <li key={point.text} className="flex items-center gap-3 text-on-brand-muted">
                <span className="flex size-9 items-center justify-center rounded-full bg-white/15 text-on-brand">
                  <Icon name={point.icon} size={18} />
                </span>
                {point.text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm text-on-brand-muted">
          Portfolio project with fictional data.
        </p>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between px-5 py-4 sm:px-8">
          <p className="flex items-center gap-2 text-lg font-bold text-primary-text lg:invisible">
            <TemporaMark size={24} /> Tempora Console
          </p>
          <ThemeToggle />
        </header>
        <main className="flex flex-1 items-start justify-center px-4 pt-6 pb-16 sm:items-center sm:px-8">
          <div className="flex w-full max-w-[420px] flex-col gap-6">
            <div className="flex flex-col gap-2">
              <h1 className="text-[28px] leading-tight font-extrabold">{title}</h1>
              {description && <p className="text-muted">{description}</p>}
            </div>
            {children}
            {footer && <div className="text-sm text-muted">{footer}</div>}
          </div>
        </main>
      </div>
    </div>
  );
}
