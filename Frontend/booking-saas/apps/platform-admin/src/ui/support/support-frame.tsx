// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import { Alert, Badge, Button, Icon } from '@tempora/ui';
import type { UseQueryResult } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { useStepUp } from '@/core/auth/presentation/use-admin-auth';
import { toRequestErrorView } from '@/core/shared/presentation/error-view';
import { PLATFORM_TIME_ZONE } from '@/core/shared/presentation/time-zone';
import { grantBanner, SUPPORT_VIEWS, supportBlock } from '@/core/support/presentation/use-support';
import { useTenant } from '@/core/tenants/presentation/use-tenants';
import { RequestErrorAlert } from '@/ui/common/request-error';
import { StepUpDialog } from '@/ui/common/step-up-dialog';

const LABELS = { bookings: 'Bookings', customers: 'Customers', invoices: 'Invoices' } as const;

/** Re-renders every 30 seconds, so the time left in the banner stays right. */
function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

/**
 * FSD 2.3 Support view: the tenant, the grant's expiry in a banner, and the three read-only
 * views. The banner reads the tenant detail; the data pages ask the API themselves, which
 * checks the grant on every call.
 */
export function SupportFrame({
  tenantId,
  children,
}: Readonly<{ tenantId: string; children: ReactNode }>) {
  const tenant = useTenant(tenantId);
  const pathname = usePathname();
  const now = useNow();
  const access = tenant.data?.supportAccess;
  const banner = access && grantBanner(access.expiresAt, now, PLATFORM_TIME_ZONE);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href={`/tenants/${tenantId}`} className="text-sm font-semibold text-primary-text">
            ← {tenant.data?.name ?? 'Tenant'}
          </Link>
          <h1 className="mt-1 text-[26px] font-extrabold">Support view</h1>
        </div>
        <Badge tone="neutral" className="py-1.5">
          <Icon name="shield" size={14} strokeWidth={2} />
          Read only · every page is in the owner&apos;s audit log
        </Badge>
      </div>
      {tenant.data &&
        (banner ? (
          <Alert tone="info" title="Support access granted by the owner">
            {banner}
          </Alert>
        ) : (
          <Alert tone="danger" title="Support access is closed">
            The owner has not granted access, or it has ended.
          </Alert>
        ))}
      <nav aria-label="Support views" className="flex flex-wrap gap-2">
        {SUPPORT_VIEWS.map((view) => {
          const href = `/tenants/${tenantId}/support/${view}`;
          const active = pathname.startsWith(href);
          return (
            <Link
              key={view}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={`flex min-h-11 items-center rounded-full px-4 text-sm font-semibold ${
                active ? 'bg-primary text-primary-foreground' : 'bg-surface-muted text-foreground'
              }`}
            >
              {LABELS[view]}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}

/**
 * Loading, blocked and error states of a support query. A missing step-up asks for a code
 * and loads the page again; a closed grant explains why there is nothing to show.
 */
export function SupportGate<T>({
  query,
  children,
}: Readonly<{ query: UseQueryResult<T>; children: (data: T) => ReactNode }>) {
  const stepUp = useStepUp();
  const [error, setError] = useState<unknown>(null);
  const block = supportBlock(query.error);

  if (query.data !== undefined) return <>{children(query.data)}</>;
  if (query.isPending) {
    return <div className="h-64 animate-pulse rounded-card bg-surface-muted" />;
  }
  if (block === 'closed') {
    return (
      <Alert tone="info" title="Nothing to show">
        Support access is closed for this business. Ask the owner to grant it in Console → Settings.
      </Alert>
    );
  }
  if (block === 'step-up') {
    const retry = async () => {
      const result = await query.refetch();
      if (result.error) throw result.error;
    };
    return (
      <>
        <Alert tone="info" title="Confirm it is you to see this business's data">
          Support views need a code from the last 10 minutes.
          <span className="mt-3 block">
            <Button
              onClick={() => {
                setError(null);
                stepUp.run(retry).catch(setError);
              }}
            >
              Email me a code
            </Button>
          </span>
        </Alert>
        <RequestErrorAlert error={toRequestErrorView(error)} />
        <StepUpDialog stepUp={stepUp} />
      </>
    );
  }
  return <RequestErrorAlert error={toRequestErrorView(query.error)} />;
}
