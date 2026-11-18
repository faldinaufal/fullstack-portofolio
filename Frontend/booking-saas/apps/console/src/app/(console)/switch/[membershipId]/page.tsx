// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { SwitchBusinessScreen } from '@/ui/shell/switch-business-screen';

export default async function Page({
  params,
}: Readonly<{ params: Promise<{ membershipId: string }> }>) {
  const { membershipId } = await params;
  return <SwitchBusinessScreen membershipId={membershipId} />;
}
