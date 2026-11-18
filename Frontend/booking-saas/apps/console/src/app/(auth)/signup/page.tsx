// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { Metadata } from 'next';

import { SignupScreen } from '@/ui/auth/signup-screen';

export const metadata: Metadata = { title: 'Create business account' };

export default function Page() {
  return <SignupScreen />;
}
