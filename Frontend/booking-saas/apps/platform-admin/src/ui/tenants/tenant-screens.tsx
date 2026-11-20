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
  CardHeader,
  CardTitle,
  ConfirmDialog,
  SelectField,
  TextField,
} from '@tempora/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type SubmitEvent } from 'react';
import { useStepUp } from '@/core/auth/presentation/use-admin-auth';
import { toRequestErrorView } from '@/core/shared/presentation/error-view';
import { PLATFORM_TIME_ZONE } from '@/core/shared/presentation/time-zone';
import {
  statusOf,
  suggestSlug,
  useCreateTenant,
  useReactivateTenant,
  useSuspendTenant,
  useTenant,
  useTenants,
  type TenantFilter,
  type TenantQuery,
} from '@/core/tenants/presentation/use-tenants';
import { RequestErrorAlert } from '@/ui/common/request-error';
import { StepUpDialog } from '@/ui/common/step-up-dialog';

const date = (instant: Date | null) =>
  instant
    ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(
        instant,
      )
    : '—';

const dateTime = (instant: Date) =>
  new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: PLATFORM_TIME_ZONE,
  }).format(instant);

function Header({ title, description }: Readonly<{ title: string; description?: string }>) {
  return (
    <div>
      <h1 className="text-[26px] font-extrabold">{title}</h1>
      {description && <p className="mt-1 text-sm text-muted">{description}</p>}
    </div>
  );
}

/** FSD 2.3 `/tenants`: status, usage, search. */
export function TenantsScreen() {
  const [query, setQuery] = useState<TenantQuery>({ page: 1 });
  const list = useTenants(query);
  const set = (changes: Partial<TenantQuery>) => setQuery((q) => ({ ...q, page: 1, ...changes }));
  const pages = list.data ? Math.max(1, Math.ceil(list.data.total / list.data.pageSize)) : 1;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Header title="Tenants" description="Every business on Tempora: metadata and usage only." />
        <Link href="/tenants/new" className={buttonVariants()}>
          Create tenant
        </Link>
      </div>
      <Card>
        <CardContent className="grid gap-3 p-5 sm:grid-cols-2">
          <TextField
            label="Search"
            placeholder="Name or address"
            value={query.q ?? ''}
            onChange={(e) => set({ q: e.target.value || undefined })}
          />
          <SelectField
            label="Status"
            options={[
              { value: '', label: 'All' },
              { value: 'active', label: 'Active' },
              { value: 'onboarding', label: 'Onboarding' },
              { value: 'suspended', label: 'Suspended' },
            ]}
            value={query.status ?? ''}
            onChange={(e) => set({ status: (e.target.value || undefined) as TenantFilter })}
          />
        </CardContent>
      </Card>
      {list.isError && <Alert tone="danger">Tenants could not be loaded.</Alert>}
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="text-left text-[13px] text-muted">
                {['Business', 'Status', 'Members', 'Bookings (30 days)', 'Created'].map((h) => (
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
                    No tenants match.
                  </td>
                </tr>
              )}
              {list.data?.items.map((t) => (
                <tr key={t.id} className="border-t border-border">
                  <td className="px-5 py-3">
                    <Link href={`/tenants/${t.id}`} className="font-bold hover:text-primary-text">
                      {t.name}
                    </Link>
                    <span className="block text-[13px] text-muted">{t.slug}</span>
                  </td>
                  <td className="px-5 py-3">
                    <Badge tone={statusOf(t).tone} dot>
                      {statusOf(t).label}
                    </Badge>
                  </td>
                  <td className="px-5 py-3">{t.members}</td>
                  <td className="px-5 py-3">{t.recentBookings}</td>
                  <td className="px-5 py-3">{date(t.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
      {pages > 1 && (
        <nav aria-label="Pages" className="flex items-center gap-3">
          <Button
            variant="secondary"
            disabled={query.page <= 1}
            onClick={() => setQuery({ ...query, page: query.page - 1 })}
          >
            Previous
          </Button>
          <span className="text-sm text-muted">
            Page {query.page} of {pages}
          </span>
          <Button
            variant="secondary"
            disabled={query.page >= pages}
            onClick={() => setQuery({ ...query, page: query.page + 1 })}
          >
            Next
          </Button>
        </nav>
      )}
    </div>
  );
}

/** FSD 2.3 `/tenants/[id]`: metadata, owner, suspend / reactivate (step-up). */
export function TenantDetailScreen({ id }: Readonly<{ id: string }>) {
  const tenant = useTenant(id);
  const suspend = useSuspendTenant(id);
  const reactivate = useReactivateTenant(id);
  const stepUp = useStepUp();
  const [suspending, setSuspending] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<unknown>(null);

  if (tenant.isPending) return <div className="h-64 animate-pulse rounded-card bg-surface-muted" />;
  if (tenant.isError) {
    return (
      <Alert tone="danger">
        Tenant not found.{' '}
        <Link href="/tenants" className="font-semibold underline">
          Back to tenants
        </Link>
      </Alert>
    );
  }
  const t = tenant.data;
  const status = statusOf(t);
  const act = (work: () => Promise<unknown>) => {
    setError(null);
    stepUp.run(work).catch(setError);
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Header title={t.name} description={`${t.slug} · invoices ${t.invoicePrefix}-…`} />
        <Badge tone={status.tone} dot>
          {status.label}
        </Badge>
      </div>
      {t.status === 'suspended' && (
        <Alert tone="danger" title={`Suspended since ${date(t.suspendedAt)}`}>
          {t.suspensionReason}
        </Alert>
      )}
      <RequestErrorAlert error={toRequestErrorView(error)} />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Owner</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-sm">
            {t.owner && (
              <>
                <span className="font-semibold">{t.owner.name}</span>
                <a href={`mailto:${t.owner.email}`} className="text-primary-text">
                  {t.owner.email}
                </a>
              </>
            )}
            {!t.owner && t.ownerInvitation && (
              <span>
                Invited {t.ownerInvitation.email} ·{' '}
                {t.ownerInvitation.status === 'pending'
                  ? `waiting, expires ${date(t.ownerInvitation.expiresAt)}`
                  : 'invitation expired'}
              </span>
            )}
            {!t.owner && !t.ownerInvitation && <span className="text-muted">No owner yet.</span>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Usage</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-sm">
            <span>{t.members} active members</span>
            <span>{t.recentBookings} bookings in the last 30 days</span>
            <span>Created {date(t.createdAt)}</span>
            {t.onboarding && <span className="text-muted">Setup not complete yet.</span>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Support access</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 text-sm">
          {t.supportAccess ? (
            <>
              <span>
                Granted by the owner until {dateTime(t.supportAccess.expiresAt)}. Read only; every
                page you open is in the owner&apos;s audit log.
              </span>
              <Link href={`/tenants/${t.id}/support/bookings`} className={buttonVariants()}>
                Open support view
              </Link>
            </>
          ) : (
            <span className="text-muted">
              Closed. The owner can grant it in Console → Settings for 1, 24 or 72 hours.
            </span>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
          <span className="text-sm text-muted">
            Suspending stops new bookings and makes the Console read only; the owner is emailed.
            Both need a fresh code.
          </span>
          {t.status === 'active' ? (
            <Button variant="danger" onClick={() => setSuspending(true)}>
              Suspend
            </Button>
          ) : (
            <Button
              disabled={reactivate.isPending}
              onClick={() => act(() => reactivate.mutateAsync())}
            >
              Reactivate
            </Button>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={suspending}
        title={`Suspend ${t.name}?`}
        confirmLabel="Suspend"
        destructive
        busy={suspend.isPending || reason.trim().length < 3}
        onConfirm={() => {
          setSuspending(false);
          act(() => suspend.mutateAsync(reason.trim()));
        }}
        onCancel={() => setSuspending(false)}
      >
        <span className="flex flex-col gap-3">
          <span>The owner sees the reason in the email and in the Console.</span>
          <TextField
            label="Reason (required)"
            value={reason}
            maxLength={500}
            onChange={(e) => setReason(e.target.value)}
          />
        </span>
      </ConfirmDialog>
      <StepUpDialog stepUp={stepUp} />
    </div>
  );
}

/** FSD 2.3 `/tenants/new`, flow 3.5: the business and the owner to invite. */
export function CreateTenantScreen() {
  const router = useRouter();
  const create = useCreateTenant();
  const stepUp = useStepUp();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const view = toRequestErrorView(error ?? create.error);

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const input = { businessName: name, slug, ownerEmail: String(form.get('ownerEmail') ?? '') };
    setError(null);
    stepUp
      .run(async () => {
        const created = await create.mutateAsync(input);
        router.push(`/tenants/${created.id}`);
      })
      .catch(setError);
  }

  return (
    <div className="flex max-w-[640px] flex-col gap-5">
      <Header
        title="Create tenant"
        description="Assisted onboarding: the owner gets an invitation and finishes the setup in the Console."
      />
      <Card>
        <CardContent className="p-5">
          <form className="flex flex-col gap-4" onSubmit={submit}>
            <RequestErrorAlert error={view} />
            <TextField
              label="Business name"
              value={name}
              required
              maxLength={100}
              onChange={(e) => {
                setName(e.target.value);
                if (!slugEdited) setSlug(suggestSlug(e.target.value));
              }}
              error={view?.fields['businessName']}
            />
            <TextField
              label="Address (slug)"
              hint="Lowercase letters, digits and dashes; the Portal page is tempora/<slug>."
              value={slug}
              required
              onChange={(e) => {
                setSlugEdited(true);
                setSlug(e.target.value);
              }}
              error={view?.fields['slug']}
            />
            <TextField
              label="Owner email"
              name="ownerEmail"
              type="email"
              required
              error={view?.fields['ownerEmail']}
            />
            <Button type="submit" size="lg" className="self-start" disabled={create.isPending}>
              {create.isPending ? 'Creating…' : 'Create and invite owner'}
            </Button>
          </form>
        </CardContent>
      </Card>
      <StepUpDialog stepUp={stepUp} />
    </div>
  );
}
