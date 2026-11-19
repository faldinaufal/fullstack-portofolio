// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { Metadata } from 'next';
import { BookingsScreen } from '@/ui/bookings/bookings-screen';

export const metadata: Metadata = { title: 'Bookings' };

export default function Page() {
  return <BookingsScreen />;
}
