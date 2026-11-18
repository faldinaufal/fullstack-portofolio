// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { ReactNode } from 'react';

/** Title row of a Console page: heading, short description, actions on the right. */
export function PageHeader({
  title,
  description,
  actions,
}: Readonly<{ title: string; description?: ReactNode; actions?: ReactNode }>) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-[26px] font-extrabold">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
