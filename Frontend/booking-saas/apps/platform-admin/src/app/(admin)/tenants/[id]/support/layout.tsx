// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { ReactNode } from 'react';
import { SupportFrame } from '@/ui/support/support-frame';

export default async function Layout({
  children,
  params,
}: Readonly<{ children: ReactNode; params: Promise<{ id: string }> }>) {
  const { id } = await params;
  return <SupportFrame tenantId={id}>{children}</SupportFrame>;
}
