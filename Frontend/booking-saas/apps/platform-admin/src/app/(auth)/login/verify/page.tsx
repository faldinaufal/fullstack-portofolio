// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { Metadata } from 'next';
import { Suspense } from 'react';
import { VerifyScreen } from '@/ui/auth/auth-screens';

export const metadata: Metadata = { title: 'Verify code' };

export default function Page() {
  return (
    <Suspense>
      <VerifyScreen />
    </Suspense>
  );
}
