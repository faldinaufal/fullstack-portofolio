// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import { Badge, Button, Card, Icon, TextField } from '@tempora/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { useCurrentMember } from '@/core/auth/presentation/use-auth';
import { useBranches, useCreateBranch } from '@/core/branches/presentation/use-branches';
import { toRequestErrorView } from '@/core/shared/presentation/error-view';
import { PageHeader } from '@/ui/common/page-header';
import { RequestErrorAlert } from '@/ui/common/request-error';
import { SidePanel } from '@/ui/common/side-panel';

/** FSD 2.2 Branches: owner sees and creates every branch; a manager sees their own. */
export function BranchesScreen() {
  const me = useCurrentMember();
  const branches = useBranches();
  const [creating, setCreating] = useState(false);

  return (
    <>
      <PageHeader
        title="Branches"
        description={me.role === 'owner' ? 'Every location of your business.' : 'Your branch.'}
        actions={
          me.role === 'owner' && (
            <Button onClick={() => setCreating(true)}>
              <Icon name="plus" size={18} /> New branch
            </Button>
          )
        }
      />

      {branches.isPending && <div className="h-40 animate-pulse rounded-card bg-surface-muted" />}
      <RequestErrorAlert error={toRequestErrorView(branches.error)} />

      {branches.data?.length === 0 && (
        <Card className="flex flex-col items-start gap-3 p-6">
          <p className="text-lg font-extrabold">No branches yet</p>
          <p className="text-sm text-muted">
            Add your first location, then its opening hours. Team members work at a branch.
          </p>
          {me.role === 'owner' && <Button onClick={() => setCreating(true)}>Add a branch</Button>}
        </Card>
      )}

      {branches.data && branches.data.length > 0 && (
        <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4 p-0">
          {branches.data.map((branch) => (
            <li key={branch.id}>
              <Link
                href={`/branches/${branch.id}`}
                className="flex h-full flex-col gap-2 rounded-card border border-border bg-surface p-5 text-foreground no-underline hover:border-primary"
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-lg font-extrabold">{branch.name}</span>
                  {branch.archived && <Badge tone="neutral">Archived</Badge>}
                </span>
                <span className="text-sm text-muted">{branch.contact}</span>
                <span className="mt-auto flex items-center gap-1.5 pt-2 text-sm font-semibold text-primary-text">
                  <Icon name="team" size={16} /> {branch.members}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <NewBranchPanel open={creating} onClose={() => setCreating(false)} />
    </>
  );
}

function NewBranchPanel({ open, onClose }: Readonly<{ open: boolean; onClose: () => void }>) {
  const router = useRouter();
  const create = useCreateBranch();
  const error = toRequestErrorView(create.error);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name)).trim() || null;
    create.mutate(
      { name: String(form.get('name')).trim(), address: text('address'), phone: text('phone') },
      { onSuccess: (branch) => router.push(`/branches/${branch.id}`) },
    );
  }

  return (
    <SidePanel open={open} title="New branch" onClose={onClose}>
      <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
        <RequestErrorAlert error={error} />
        <TextField label="Name" name="name" required error={error?.fields.name} />
        <TextField
          label="Address"
          name="address"
          autoComplete="street-address"
          error={error?.fields.address}
        />
        <TextField
          label="Phone"
          name="phone"
          type="tel"
          placeholder="+15550147123"
          hint="International format."
          error={error?.fields.phone}
        />
        <Button type="submit" size="lg" disabled={create.isPending}>
          {create.isPending ? 'Creating…' : 'Create branch'}
        </Button>
      </form>
    </SidePanel>
  );
}
