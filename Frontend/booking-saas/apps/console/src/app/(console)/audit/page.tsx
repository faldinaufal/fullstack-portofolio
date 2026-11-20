// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { Metadata } from 'next';
import { AuditLogScreen } from '@/ui/logs/log-screens';

export const metadata: Metadata = { title: 'Audit log' };

export default function Page() {
  return <AuditLogScreen />;
}
