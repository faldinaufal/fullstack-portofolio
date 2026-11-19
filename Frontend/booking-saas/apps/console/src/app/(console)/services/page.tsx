// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { Metadata } from 'next';
import { ServicesScreen } from '@/ui/services/services-screen';

export const metadata: Metadata = { title: 'Services' };

export default function Page() {
  return <ServicesScreen />;
}
