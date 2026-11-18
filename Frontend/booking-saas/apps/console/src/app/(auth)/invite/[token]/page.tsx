// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { Metadata } from 'next';
import { AcceptInvitationScreen } from '@/ui/auth/accept-invitation-screen';

export const metadata: Metadata = { title: 'Accept invitation', referrer: 'no-referrer' };

export default async function Page({ params }: Readonly<{ params: Promise<{ token: string }> }>) {
  const { token } = await params;
  return <AcceptInvitationScreen token={token} />;
}
