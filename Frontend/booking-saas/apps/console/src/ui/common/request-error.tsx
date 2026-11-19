// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { Alert } from '@tempora/ui';
import Link from 'next/link';
import type { RequestErrorView } from '@/core/shared/presentation/error-view';

const when = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

/** Error summary for a failed action, with a support reference when unexpected. */
export function RequestErrorAlert({ error }: Readonly<{ error: RequestErrorView | null }>) {
  if (!error) return null;
  return (
    <Alert tone="danger">
      {error.message}
      {error.reference && (
        <span className="mt-1 block text-xs text-muted">Reference: {error.reference}</span>
      )}
      {error.conflicts.length > 0 && (
        <ul className="mt-2 mb-0 flex list-none flex-col gap-1 p-0 text-sm">
          {error.conflicts.map((c) => (
            <li key={c.id}>
              <Link href={`/bookings/${c.id}`} className="font-semibold underline">
                {when.format(c.startsAt)}
              </Link>{' '}
              · {c.serviceName} · {c.customerName} · with {c.therapist}
            </li>
          ))}
        </ul>
      )}
    </Alert>
  );
}
