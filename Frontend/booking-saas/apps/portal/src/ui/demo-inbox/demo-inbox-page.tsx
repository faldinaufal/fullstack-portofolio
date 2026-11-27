// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { DEMO_MODE } from '@/core/shared/presentation/demo';
import { DemoInboxScreen } from './demo-inbox-screen';

/** Only the public demo has an inbox (FSD 10.3); the API answers 404 otherwise too. */
export function DemoInboxPage() {
  if (!DEMO_MODE) notFound();
  return (
    <Suspense>
      <DemoInboxScreen />
    </Suspense>
  );
}
