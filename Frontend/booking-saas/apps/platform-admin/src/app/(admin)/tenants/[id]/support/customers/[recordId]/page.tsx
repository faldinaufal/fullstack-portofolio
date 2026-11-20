// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { Metadata } from 'next';
import { SupportCustomerScreen } from '@/ui/support/support-screens';

export const metadata: Metadata = { title: 'Support · Customer' };

export default async function Page({
  params,
}: Readonly<{ params: Promise<{ id: string; recordId: string }> }>) {
  const { id, recordId } = await params;
  return <SupportCustomerScreen tenantId={id} id={recordId} />;
}
