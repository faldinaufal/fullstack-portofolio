// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { Metadata } from 'next';
import { ConfirmationScreen } from '@/ui/reservation/reservation-screens';

export const metadata: Metadata = { title: 'Booking confirmation', robots: { index: false } };

export default async function Page({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  return <ConfirmationScreen id={id} />;
}
