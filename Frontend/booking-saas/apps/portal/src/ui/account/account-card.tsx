// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { ReactNode } from 'react';

/** Centered card for the account pages, inside the Portal header and footer. */
export function AccountCard({
  title,
  description,
  children,
  footer,
}: Readonly<{ title: string; description?: ReactNode; children: ReactNode; footer?: ReactNode }>) {
  return (
    <main className="px-4 py-12 sm:px-6">
      <div className="mx-auto flex w-full max-w-[440px] flex-col gap-6 rounded-panel border border-border bg-surface p-6 sm:p-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-[28px] leading-tight font-extrabold">{title}</h1>
          {description && <p className="text-muted">{description}</p>}
        </div>
        {children}
        {footer && <div className="text-sm text-muted">{footer}</div>}
      </div>
    </main>
  );
}
