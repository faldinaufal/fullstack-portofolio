// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { Metadata } from 'next';
import { ManageScreen } from '@/ui/reservation/reservation-screens';

/**
 * The guest link carries its secret in the URL: keep it out of search engines and out of the
 * Referer header sent to other sites (FSD 5.3).
 */
export const metadata: Metadata = {
  title: 'Your booking',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default async function Page({ params }: Readonly<{ params: Promise<{ token: string }> }>) {
  const { token } = await params;
  return <ManageScreen token={token} />;
}
