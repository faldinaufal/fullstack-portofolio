// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { Metadata } from 'next';
import { CreateTenantScreen } from '@/ui/tenants/tenant-screens';

export const metadata: Metadata = { title: 'Create tenant' };

export default function Page() {
  return <CreateTenantScreen />;
}
