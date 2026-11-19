// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import { useCurrentMember } from '@/core/auth/presentation/use-auth';
import { TodayScreen } from '@/ui/bookings/today-screen';
import { DashboardScreen } from '@/ui/dashboard/dashboard-screen';

/** `/`: the dashboard for owners and managers, "Today" for staff (FSD 2.2). */
export function HomeScreen() {
  const member = useCurrentMember();
  return member.role === 'staff' ? <TodayScreen /> : <DashboardScreen />;
}
