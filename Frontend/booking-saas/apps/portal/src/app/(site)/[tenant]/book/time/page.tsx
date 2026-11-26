// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { redirect } from 'next/navigation';

/** The booking steps are one page now (FSD 2.1): old links land there with their choices. */
export default async function Page({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ tenant: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>) {
  const { tenant } = await params;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (typeof value === 'string') query.set(key, value);
  }
  redirect(`/${encodeURIComponent(tenant)}/book?${query}`);
}
