// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ChooseScreen } from '@/ui/booking/choose-screen';

export const metadata: Metadata = { title: 'Book a session' };

export default async function Page({ params }: Readonly<{ params: Promise<{ tenant: string }> }>) {
  const { tenant } = await params;
  return (
    // The choices live in the URL query, which is only known in the browser.
    <Suspense>
      <ChooseScreen slug={tenant} />
    </Suspense>
  );
}
