// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import { Button } from '@tempora/ui';

/** Previous / next for the Console's tables; hidden when everything fits on one page. */
export function Pagination({
  page,
  pageSize,
  total,
  onPage,
}: Readonly<{ page: number; pageSize: number; total: number; onPage: (page: number) => void }>) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <nav aria-label="Pages" className="flex items-center gap-3">
      <Button variant="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Previous
      </Button>
      <span className="text-sm text-muted">
        Page {page} of {pages} · {total} in total
      </span>
      <Button variant="secondary" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        Next
      </Button>
    </nav>
  );
}
