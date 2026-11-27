// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { Metadata } from 'next';
import { DemoInboxPage } from '@/ui/demo-inbox/demo-inbox-page';

export const metadata: Metadata = { title: 'Demo inbox', robots: { index: false } };

export default function Page() {
  return <DemoInboxPage />;
}
