// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { Metadata } from 'next';
import { MyBookingsScreen } from '@/ui/reservation/reservation-screens';

export const metadata: Metadata = { title: 'My bookings', robots: { index: false } };

export default function Page() {
  return <MyBookingsScreen />;
}
