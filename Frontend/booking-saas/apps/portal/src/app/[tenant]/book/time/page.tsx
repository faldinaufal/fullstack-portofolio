// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { Metadata } from 'next';
import { Suspense } from 'react';
import { TimeScreen } from '@/ui/booking/time-screen';

export const metadata: Metadata = { title: 'Choose a time' };

export default async function Page({ params }: Readonly<{ params: Promise<{ tenant: string }> }>) {
  const { tenant } = await params;
  return (
    <Suspense>
      <TimeScreen slug={tenant} />
    </Suspense>
  );
}
