// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { Metadata } from 'next';
import { AuditScreen } from '@/ui/audit/audit-and-account';

export const metadata: Metadata = { title: 'Platform audit' };

export default function Page() {
  return <AuditScreen />;
}
