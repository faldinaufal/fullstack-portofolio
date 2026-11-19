// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { Metadata } from 'next';
import { InvoicesScreen } from '@/ui/records/invoice-screens';

export const metadata: Metadata = { title: 'Invoices' };

export default function Page() {
  return <InvoicesScreen />;
}
