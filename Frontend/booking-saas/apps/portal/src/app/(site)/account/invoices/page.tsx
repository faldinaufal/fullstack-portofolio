// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { Metadata } from 'next';
import { MyInvoicesScreen } from '@/ui/reservation/my-invoices-screen';

export const metadata: Metadata = { title: 'Invoices', robots: { index: false } };

export default function Page() {
  return <MyInvoicesScreen />;
}
