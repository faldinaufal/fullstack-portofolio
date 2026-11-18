// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { Metadata } from 'next';

import { ForgotPasswordScreen } from '@/ui/auth/forgot-password-screen';

export const metadata: Metadata = { title: 'Reset password' };

export default function Page() {
  return <ForgotPasswordScreen />;
}
