// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { Metadata } from 'next';
import { CalendarScreen } from '@/ui/bookings/calendar-screen';

export const metadata: Metadata = { title: 'Calendar' };

export default function Page() {
  return <CalendarScreen />;
}
