// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { Metadata } from 'next';
import { CustomersScreen } from '@/ui/records/customer-screens';

export const metadata: Metadata = { title: 'Customers' };

export default function Page() {
  return <CustomersScreen />;
}
