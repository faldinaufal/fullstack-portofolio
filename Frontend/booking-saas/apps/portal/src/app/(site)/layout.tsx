// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { ReactNode } from 'react';
import { SiteFooter } from '@/ui/shell/site-footer';
import { SiteHeader } from '@/ui/shell/site-header';

/** Every Portal page except the account pages: top navigation and footer. */
export default function SiteLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <>
      <SiteHeader />
      {children}
      <SiteFooter />
    </>
  );
}
