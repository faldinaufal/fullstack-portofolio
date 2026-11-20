// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import {
  Alert,
  Badge,
  Button,
  buttonVariants,
  Card,
  CardContent,
  SelectField,
  TextField,
} from '@tempora/ui';
import Link from 'next/link';
import { useState } from 'react';
import {
  ACTION_GROUPS,
  actionLabel,
  diffOf,
  EMAIL_STATUS,
  templateLabel,
  useAuditExportUrl,
  useAuditLog,
  useEmailLog,
  type AuditEntry,
  type AuditFilters,
  type EmailFilters,
  type EmailStatus,
} from '@/core/logs/presentation/use-logs';
import { PageHeader } from '@/ui/common/page-header';
import { Pagination } from '@/ui/records/pagination';

const when = (instant: Date | null, timeZone: string) =>
  instant
    ? new Intl.DateTimeFormat('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone,
      }).format(instant)
    : '—';

const ACTOR_TYPE: Record<AuditEntry['actor']['type'], string> = {
  team_member: 'Team',
  platform_admin: 'Tempora',
  customer: 'Customer',
  system: 'System',
};

/** Where an entry's record can be opened in the Console, if anywhere. */
function recordHref(entry: AuditEntry): string | null {
  if (!entry.entityId) return null;
  if (entry.entityType === 'booking') return `/bookings/${entry.entityId}`;
  if (entry.entityType === 'branch') return `/branches/${entry.entityId}`;
  return null;
}

function Changes({ entry }: Readonly<{ entry: AuditEntry }>) {
  const changes = diffOf(entry.before, entry.after);
  if (changes.length === 0) return null;
  return (
    <details className="mt-2">
      <summary className="cursor-pointer text-[13px] font-semibold text-primary-text">
        {changes.length === 1 ? '1 change' : `${changes.length} changes`}
      </summary>
      <table className="mt-2 w-full border-collapse text-[13px]">
        <caption className="sr-only">Before and after</caption>
        <thead>
          <tr className="text-left text-muted">
            <th scope="col" className="py-1 pr-3 font-semibold">
              Field
            </th>
            <th scope="col" className="py-1 pr-3 font-semibold">
              Before
            </th>
            <th scope="col" className="py-1 font-semibold">
              After
            </th>
          </tr>
        </thead>
        <tbody>
          {changes.map((c) => (
            <tr key={c.field} className="border-t border-border align-top">
              <td className="py-1 pr-3 font-semibold">{c.field}</td>
              <td className="py-1 pr-3 break-all text-muted">{c.before}</td>
              <td className="py-1 break-all">{c.after}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

/** FSD 2.2 `/audit`: owner (whole business) and manager (own branch). */
export function AuditLogScreen() {
  const [filters, setFilters] = useState<AuditFilters>({});
  const log = useAuditLog(filters);
  const exportUrl = useAuditExportUrl(filters);
  const set = (changes: Partial<AuditFilters>) => setFilters((f) => ({ ...f, ...changes }));
  const entries = log.data?.pages.flatMap((page) => page.items) ?? [];
  const timeZone = log.data?.pages[0]?.timeZone ?? 'UTC';

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Audit log"
        description="Who changed what, and when. Entries can never be edited or removed."
        actions={
          <a href={exportUrl} className={buttonVariants({ variant: 'secondary' })}>
            Export CSV
          </a>
        }
      />
      <Card>
        <CardContent className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <TextField
            label="Who"
            placeholder="Name"
            value={filters.actor ?? ''}
            onChange={(e) => set({ actor: e.target.value || undefined })}
          />
          <SelectField
            label="What"
            options={[{ value: '', label: 'Everything' }, ...ACTION_GROUPS]}
            value={filters.action ?? ''}
            onChange={(e) => set({ action: e.target.value || undefined })}
          />
          <TextField
            label="From"
            type="date"
            value={filters.from ?? ''}
            onChange={(e) => set({ from: e.target.value || undefined })}
          />
          <TextField
            label="To"
            type="date"
            value={filters.to ?? ''}
            onChange={(e) => set({ to: e.target.value || undefined })}
          />
        </CardContent>
      </Card>

      {log.isError && <Alert tone="danger">The audit log could not be loaded.</Alert>}
      {log.isPending && <div className="h-64 animate-pulse rounded-card bg-surface-muted" />}
      {log.data && entries.length === 0 && (
        <Card>
          <CardContent className="p-5 text-sm text-muted">
            No entries match these filters.
          </CardContent>
        </Card>
      )}
      {entries.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <ol aria-label="Audit entries">
              {entries.map((entry) => {
                const href = recordHref(entry);
                return (
                  <li key={entry.id} className="border-t border-border px-5 py-4 first:border-t-0">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-bold">
                        {href ? (
                          <Link href={href} className="hover:text-primary-text">
                            {actionLabel(entry.action)}
                          </Link>
                        ) : (
                          actionLabel(entry.action)
                        )}
                      </span>
                      <time className="text-[13px] text-muted" dateTime={entry.at.toISOString()}>
                        {when(entry.at, timeZone)}
                      </time>
                    </div>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-muted">
                      <Badge tone="neutral">{ACTOR_TYPE[entry.actor.type]}</Badge>
                      <span className="font-semibold text-foreground">{entry.actor.label}</span>
                      {entry.branch && <span>· {entry.branch.name}</span>}
                    </p>
                    {entry.reason && <p className="mt-1 text-sm">Reason: {entry.reason}</p>}
                    <Changes entry={entry} />
                  </li>
                );
              })}
            </ol>
          </CardContent>
        </Card>
      )}
      {log.hasNextPage && (
        <Button
          variant="secondary"
          className="self-start"
          disabled={log.isFetchingNextPage}
          onClick={() => log.fetchNextPage()}
        >
          {log.isFetchingNextPage ? 'Loading…' : 'Load older entries'}
        </Button>
      )}
    </div>
  );
}

/** FSD 2.2 `/emails`: what was sent, what failed and why, what is still waiting. */
export function EmailLogScreen() {
  const [filters, setFilters] = useState<EmailFilters>({ page: 1 });
  const list = useEmailLog(filters);
  const set = (changes: Partial<EmailFilters>) =>
    setFilters((f) => ({ ...f, page: 1, ...changes }));

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Email log"
        description="Emails Tempora sent for your business. Failed emails are retried up to 5 times."
      />
      <Card>
        <CardContent className="grid gap-3 p-5 sm:grid-cols-2">
          <TextField
            label="Recipient"
            placeholder="Email address"
            value={filters.q ?? ''}
            onChange={(e) => set({ q: e.target.value || undefined })}
          />
          <SelectField
            label="Status"
            options={[
              { value: '', label: 'All statuses' },
              ...(Object.keys(EMAIL_STATUS) as EmailStatus[]).map((value) => ({
                value,
                label: EMAIL_STATUS[value].label,
              })),
            ]}
            value={filters.status ?? ''}
            onChange={(e) => set({ status: (e.target.value || undefined) as EmailStatus })}
          />
        </CardContent>
      </Card>

      {list.isError && <Alert tone="danger">The email log could not be loaded.</Alert>}
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <caption className="sr-only">Emails</caption>
            <thead>
              <tr className="text-left text-[13px] text-muted">
                {['Email', 'Recipient', 'Status', 'Created', 'Details'].map((h) => (
                  <th key={h} scope="col" className="px-5 py-3 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.data?.items.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-6 text-muted">
                    No emails match these filters.
                  </td>
                </tr>
              )}
              {list.data?.items.map((email) => {
                const tz = list.data.timeZone;
                const status = EMAIL_STATUS[email.status];
                return (
                  <tr key={email.id} className="border-t border-border align-top">
                    <td className="px-5 py-3 font-semibold">
                      {email.bookingId ? (
                        <Link
                          href={`/bookings/${email.bookingId}`}
                          className="hover:text-primary-text"
                        >
                          {templateLabel(email.template)}
                        </Link>
                      ) : (
                        templateLabel(email.template)
                      )}
                    </td>
                    <td className="px-5 py-3 break-all">{email.to}</td>
                    <td className="px-5 py-3">
                      <Badge tone={status.tone} dot>
                        {status.label}
                      </Badge>
                    </td>
                    <td className="px-5 py-3">{when(email.createdAt, tz)}</td>
                    <td className="px-5 py-3 text-[13px] text-muted">
                      {email.sentAt && <span className="block">Sent {when(email.sentAt, tz)}</span>}
                      {email.nextAttemptAt && (
                        <span className="block">
                          {email.attempts === 0 ? 'Sends' : 'Next try'}{' '}
                          {when(email.nextAttemptAt, tz)}
                        </span>
                      )}
                      {email.attempts > 1 && (
                        <span className="block">{email.attempts} attempts</span>
                      )}
                      {email.lastError && (
                        <span className="block text-danger">{email.lastError}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
      {list.data && (
        <Pagination {...list.data} onPage={(page) => setFilters((f) => ({ ...f, page }))} />
      )}
    </div>
  );
}
