// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { Metadata } from 'next';
import { LoginScreen } from '@/ui/auth/auth-screens';

export const metadata: Metadata = { title: 'Log in' };

export default function Page() {
  return <LoginScreen />;
}
