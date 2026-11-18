// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import { Alert, TemporaMark } from '@tempora/ui';
import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { useSession } from '@/core/auth/presentation/use-auth';
import type { SessionViewModel } from '@/core/auth/presentation/session.view-model';

/**
 * Shows Console pages only with a live session. This is a convenience for the browser,
 * not the security boundary: every API request checks the session itself (FSD 1.3).
 */
export function AuthGate({
  children,
}: Readonly<{ children: (session: SessionViewModel) => ReactNode }>) {
  const router = useRouter();
  const session = useSession();

  useEffect(() => {
    if (session.status === 'signed-out') router.replace('/login');
  }, [session.status, router]);

  if (session.status === 'signed-in') return children(session.view);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background p-6">
      {session.status === 'error' ? (
        <Alert tone="danger" title="Tempora cannot be reached">
          Check your connection and reload the page.
        </Alert>
      ) : (
        <p role="status" className="flex items-center gap-3 font-semibold text-muted">
          <TemporaMark className="animate-pulse text-primary-text" /> Loading your workspace…
        </p>
      )}
    </div>
  );
}
