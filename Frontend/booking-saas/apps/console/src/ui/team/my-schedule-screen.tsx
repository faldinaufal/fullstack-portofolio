// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import { useCurrentMember } from '@/core/auth/presentation/use-auth';
import { MemberDetailScreen } from './member-detail-screen';

/** FSD 2.2 My schedule: the signed-in member's own hours (read) and time off. */
export function MyScheduleScreen() {
  const me = useCurrentMember();
  return <MemberDetailScreen id={me.membershipId} mine />;
}
