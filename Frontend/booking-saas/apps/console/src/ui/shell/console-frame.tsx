// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import type { ReactNode } from 'react';
import { AuthGate } from './auth-gate';
import { ConsoleShell } from './console-shell';

/** Session check plus shell, as one client component the server layout can render. */
export function ConsoleFrame({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <AuthGate>{(session) => <ConsoleShell session={session}>{children}</ConsoleShell>}</AuthGate>
  );
}
