// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { buttonVariants } from '@tempora/ui';
import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[640px] flex-col items-start justify-center gap-4 p-6">
      <p className="text-sm font-bold text-primary-text">404</p>
      <h1 className="text-3xl font-extrabold">This screen does not exist yet</h1>
      <p className="text-muted">
        Tempora is being built screen by screen. This part of the Console is a later milestone.
      </p>
      <Link href="/" className={buttonVariants()}>
        Back to dashboard
      </Link>
    </main>
  );
}
