// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { Metadata } from 'next';
import { BranchesScreen } from '@/ui/branches/branches-screen';

export const metadata: Metadata = { title: 'Branches' };

export default function Page() {
  return <BranchesScreen />;
}
