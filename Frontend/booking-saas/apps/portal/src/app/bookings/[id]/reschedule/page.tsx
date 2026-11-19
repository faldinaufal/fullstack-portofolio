// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { Metadata } from 'next';
import { RescheduleScreen } from '@/ui/reservation/reschedule-screen';

export const metadata: Metadata = { title: 'Reschedule', robots: { index: false } };

export default async function Page({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  return <RescheduleScreen id={id} />;
}
