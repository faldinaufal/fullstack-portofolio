// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { ReactNode } from 'react';
import { ConsoleFrame } from '@/ui/shell/console-frame';

/** Every Console page inside the shell requires a session. */
export default function ConsoleLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <ConsoleFrame>{children}</ConsoleFrame>;
}
