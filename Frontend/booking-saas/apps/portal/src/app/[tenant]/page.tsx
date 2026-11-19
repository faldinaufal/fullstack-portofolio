// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { BusinessScreen } from '@/ui/business/business-screen';

export default async function Page({ params }: Readonly<{ params: Promise<{ tenant: string }> }>) {
  const { tenant } = await params;
  return <BusinessScreen slug={tenant} />;
}
