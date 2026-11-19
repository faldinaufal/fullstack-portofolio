// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { Metadata } from 'next';
import { MyScheduleScreen } from '@/ui/team/my-schedule-screen';

export const metadata: Metadata = { title: 'My schedule' };

export default function Page() {
  return <MyScheduleScreen />;
}
