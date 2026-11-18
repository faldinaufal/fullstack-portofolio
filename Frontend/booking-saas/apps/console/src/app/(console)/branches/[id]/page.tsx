// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { Metadata } from 'next';
import { BranchDetailScreen } from '@/ui/branches/branch-detail-screen';

export const metadata: Metadata = { title: 'Branch' };

export default async function Page({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  return <BranchDetailScreen id={id} />;
}
