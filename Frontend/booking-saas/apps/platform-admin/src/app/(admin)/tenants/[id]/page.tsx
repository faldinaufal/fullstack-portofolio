// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { Metadata } from 'next';
import { TenantDetailScreen } from '@/ui/tenants/tenant-screens';

export const metadata: Metadata = { title: 'Tenant' };

export default async function Page({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  return <TenantDetailScreen id={id} />;
}
