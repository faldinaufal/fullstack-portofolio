// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { BranchScreen } from '@/ui/business/branch-screen';

export default async function Page({
  params,
}: Readonly<{ params: Promise<{ tenant: string; branch: string }> }>) {
  const { tenant, branch } = await params;
  return <BranchScreen slug={tenant} branchId={branch} />;
}
