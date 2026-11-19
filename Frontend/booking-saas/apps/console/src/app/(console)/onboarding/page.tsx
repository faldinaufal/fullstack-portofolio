// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { Metadata } from 'next';
import { OnboardingScreen } from '@/ui/onboarding/onboarding-screen';

export const metadata: Metadata = { title: 'Set up your business' };

export default function Page() {
  return <OnboardingScreen />;
}
