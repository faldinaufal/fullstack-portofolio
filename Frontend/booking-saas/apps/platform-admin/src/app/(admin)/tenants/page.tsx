// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { Metadata } from 'next';
import { TenantsScreen } from '@/ui/tenants/tenant-screens';

export const metadata: Metadata = { title: 'Tenants' };

export default function Page() {
  return <TenantsScreen />;
}
