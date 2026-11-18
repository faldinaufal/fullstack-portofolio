// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import { buttonVariants } from '@tempora/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { useSwitchBusiness } from '@/core/auth/presentation/use-auth';

/** Target of the business rail links: switches the session, then opens the dashboard. */
export function SwitchBusinessScreen({ membershipId }: Readonly<{ membershipId: string }>) {
  const router = useRouter();
  const switchBusiness = useSwitchBusiness();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    switchBusiness.mutate(membershipId, { onSuccess: () => router.replace('/') });
  }, [membershipId, router, switchBusiness]);

  return switchBusiness.isError ? (
    <div className="flex flex-col items-start gap-3">
      <p role="alert" className="font-semibold text-danger">
        This business is no longer available to you.
      </p>
      <Link href="/" className={buttonVariants()}>
        Back to dashboard
      </Link>
    </div>
  ) : (
    <p role="status" className="text-muted">
      Switching business…
    </p>
  );
}
