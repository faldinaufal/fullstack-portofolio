// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { Metadata } from 'next';
import { SettingsScreen } from '@/ui/settings/settings-screen';

export const metadata: Metadata = { title: 'Settings' };

export default function Page() {
  return <SettingsScreen />;
}
