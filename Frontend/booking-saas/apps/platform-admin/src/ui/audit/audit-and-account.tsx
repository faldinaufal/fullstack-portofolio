// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import { Alert, Button, Card, CardContent, CardHeader, CardTitle } from '@tempora/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAdminSession, useLogout } from '@/core/auth/presentation/use-admin-auth';
import { actionLabel, usePlatformAudit } from '@/core/tenants/presentation/use-tenants';

const when = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

/** FSD 2.3 `/audit`: platform-level events, newest first. */
export function AuditScreen() {
  const [page, setPage] = useState(1);
  const audit = usePlatformAudit(page);
  const pages = audit.data ? Math.max(1, Math.ceil(audit.data.total / audit.data.pageSize)) : 1;
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-[26px] font-extrabold">Platform audit</h1>
        <p className="mt-1 text-sm text-muted">
          Tenants created, suspended and reactivated. Each change is also in that tenant&apos;s own
          log, which its owner can read.
        </p>
      </div>
      {audit.isError && <Alert tone="danger">The log could not be loaded.</Alert>}
      <Card>
        <CardContent className="p-0">
          <ol className="m-0 list-none p-0 text-sm">
            {audit.data?.items.length === 0 && (
              <li className="px-5 py-6 text-muted">No events yet.</li>
            )}
            {audit.data?.items.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border px-5 py-3 first:border-t-0"
              >
                <span className="w-40 shrink-0 text-muted">{when.format(entry.at)}</span>
                <span className="min-w-0 flex-1">
                  <span className="font-semibold">{actionLabel(entry.action)}</span> by{' '}
                  {entry.actor}
                  {entry.entityId && (
                    <>
                      {' '}
                      ·{' '}
                      <Link href={`/tenants/${entry.entityId}`} className="text-primary-text">
                        open tenant
                      </Link>
                    </>
                  )}
                  {entry.reason && <span className="block text-muted">{entry.reason}</span>}
                </span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
      {pages > 1 && (
        <nav aria-label="Pages" className="flex items-center gap-3">
          <Button variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Previous
          </Button>
          <span className="text-sm text-muted">
            Page {page} of {pages}
          </span>
          <Button variant="secondary" disabled={page >= pages} onClick={() => setPage(page + 1)}>
            Next
          </Button>
        </nav>
      )}
    </div>
  );
}

/** FSD 2.3 `/account`: who is signed in, and logging out. */
export function AccountScreen() {
  const router = useRouter();
  const session = useAdminSession();
  const logout = useLogout();
  if (session.status !== 'signed-in') return null;
  return (
    <div className="flex max-w-[640px] flex-col gap-5">
      <h1 className="text-[26px] font-extrabold">Account</h1>
      <Card>
        <CardHeader>
          <CardTitle>{session.admin.name}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <span>{session.admin.email}</span>
          <span className="text-muted">
            Accounts are created and disabled with a server command; sessions end after an hour
            without activity and after 8 hours at most.
          </span>
          <Button
            variant="secondary"
            className="self-start"
            disabled={logout.isPending}
            onClick={() => logout.mutate(undefined, { onSettled: () => router.replace('/login') })}
          >
            Log out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
