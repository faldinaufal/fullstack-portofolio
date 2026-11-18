// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { ApiStatusBadge } from '@/ui/health/api-status-badge';

export function SiteFooter() {
  return (
    <footer className="border-t border-border px-4 py-7 sm:px-6">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4 text-sm text-muted">
        <p className="font-bold text-foreground">Tempora</p>
        <p>Portfolio demo · all businesses and data are fictional</p>
        <ApiStatusBadge />
      </div>
    </footer>
  );
}
