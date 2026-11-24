// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { Metadata } from 'next';
import { Suspense } from 'react';
import { DemoCheckoutScreen } from '@/ui/reservation/demo-checkout-screen';

export const metadata: Metadata = { title: 'Demo payment', robots: { index: false } };

export default async function Page({
  params,
}: Readonly<{ params: Promise<{ sessionId: string }> }>) {
  const { sessionId } = await params;
  return (
    <Suspense>
      <DemoCheckoutScreen sessionId={sessionId} />
    </Suspense>
  );
}
