// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { Metadata } from 'next';
import { Suspense } from 'react';
import { DetailsScreen } from '@/ui/booking/details-screen';

export const metadata: Metadata = { title: 'Your details' };

export default async function Page({ params }: Readonly<{ params: Promise<{ tenant: string }> }>) {
  const { tenant } = await params;
  return (
    <Suspense>
      <DetailsScreen slug={tenant} />
    </Suspense>
  );
}
