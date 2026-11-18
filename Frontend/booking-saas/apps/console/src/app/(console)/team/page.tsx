// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { Metadata } from 'next';
import { TeamScreen } from '@/ui/team/team-screen';

export const metadata: Metadata = { title: 'Team' };

export default function Page() {
  return <TeamScreen />;
}
