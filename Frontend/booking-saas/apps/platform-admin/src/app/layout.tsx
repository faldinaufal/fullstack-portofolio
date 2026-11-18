// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import type { ReactNode } from 'react';
import { AppProviders } from '@/composition/app-providers';
import { APP } from '@/ui/app-info';
import { AdminShell } from '@/ui/shell/admin-shell';
import './globals.css';

const sans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans-family',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: `Tempora ${APP.name}`, template: `%s · Tempora ${APP.name}` },
  description: APP.description,
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    // next-themes sets the theme class before React hydrates.
    <html lang="en" className={sans.variable} suppressHydrationWarning>
      <body className="font-sans antialiased">
        <AppProviders>
          <AdminShell>{children}</AdminShell>
        </AppProviders>
      </body>
    </html>
  );
}
