// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { ReactNode } from 'react';
import { AdminFrame } from '@/ui/shell/admin-shell';

/** Every page inside the shell needs a Platform Admin session. */
export default function AdminLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <AdminFrame>{children}</AdminFrame>;
}
