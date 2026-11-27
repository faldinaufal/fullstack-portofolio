// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useDependencies } from '../../shared/presentation/dependencies';

export type { DemoEmail, DemoInbox, TextPart } from '../domain/demo-inbox';
export { loginCode, textParts } from '../domain/demo-inbox';

/** New codes show up without a reload: the list is fetched again every 5 seconds. */
export const DEMO_INBOX_REFRESH_MS = 5_000;

export function useDemoInbox(to: string | undefined) {
  const { demoInbox } = useDependencies();
  return useQuery({
    queryKey: ['demo-inbox', to ?? null],
    queryFn: () => demoInbox.list(to),
    refetchInterval: DEMO_INBOX_REFRESH_MS,
    placeholderData: keepPreviousData,
  });
}

/** "just now", "3 min ago", then the time of day. */
export function receivedLabel(at: Date, now: Date): string {
  const minutes = Math.floor((now.getTime() - at.getTime()) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(at);
}
