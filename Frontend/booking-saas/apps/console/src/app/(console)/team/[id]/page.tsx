// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { Metadata } from 'next';
import { MemberDetailScreen } from '@/ui/team/member-detail-screen';

export const metadata: Metadata = { title: 'Team member' };

export default async function Page({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  return <MemberDetailScreen id={id} />;
}
