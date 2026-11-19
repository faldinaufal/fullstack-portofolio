// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SignupScreen } from '@/ui/account/auth-screens';

export const metadata: Metadata = { title: 'Create account' };

export default function Page() {
  return (
    // Reads the URL query, which is only known in the browser.
    <Suspense>
      <SignupScreen />
    </Suspense>
  );
}
