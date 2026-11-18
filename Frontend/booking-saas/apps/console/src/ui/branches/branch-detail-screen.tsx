// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  Icon,
  TextField,
} from '@tempora/ui';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { useCurrentMember } from '@/core/auth/presentation/use-auth';
import {
  openingHoursProblems,
  useAddClosure,
  useArchiveBranch,
  useBranch,
  useRemoveClosure,
  useReplaceOpeningHours,
  useUpdateBranch,
  WEEK_ORDER,
  WEEKDAYS,
} from '@/core/branches/presentation/use-branches';
import { toRequestErrorView } from '@/core/shared/presentation/error-view';
import { PageHeader } from '@/ui/common/page-header';
import { RequestErrorAlert } from '@/ui/common/request-error';

type Detail = NonNullable<ReturnType<typeof useBranch>['data']>;

export function BranchDetailScreen({ id }: Readonly<{ id: string }>) {
  const me = useCurrentMember();
  const branch = useBranch(id);
  const editable = me.role === 'owner' || (me.role === 'manager' && me.branchId === id);

  return (
    <>
      <Link
        href="/branches"
        className="flex items-center gap-1.5 text-sm font-semibold text-primary-text"
      >
        <Icon name="chevron-left" size={16} /> Branches
      </Link>
      {branch.isPending && <div className="h-64 animate-pulse rounded-card bg-surface-muted" />}
      <RequestErrorAlert error={toRequestErrorView(branch.error)} />
      {branch.data && (
        <BranchContent
          branch={branch.data}
          editable={editable && !branch.data.archived}
          canArchive={me.role === 'owner'}
        />
      )}
    </>
  );
}

function BranchContent({
  branch,
  editable,
  canArchive,
}: Readonly<{ branch: Detail; editable: boolean; canArchive: boolean }>) {
  return (
    <>
      <PageHeader
        title={branch.name}
        description={branch.hoursSummary}
        actions={branch.archived && <Badge tone="neutral">Archived</Badge>}
      />
      <div className="grid gap-[22px] xl:grid-cols-2">
        {/* `key` resets the form to the saved values after every save. */}
        <DetailsCard key={`details-${branch.version}`} branch={branch} editable={editable} />
        <HoursCard
          key={`hours-${branch.version}-${branch.openingHours.length}`}
          branch={branch}
          editable={editable}
        />
        <ClosuresCard branch={branch} editable={editable} />
        {canArchive && !branch.archived && <ArchiveCard branch={branch} />}
      </div>
    </>
  );
}

function DetailsCard({ branch, editable }: Readonly<{ branch: Detail; editable: boolean }>) {
  const update = useUpdateBranch(branch.id);
  const error = toRequestErrorView(update.error, {
    VERSION_CONFLICT:
      'Someone else changed this branch in the meantime. Reload the page to see their changes.',
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name)).trim() || null;
    update.mutate({
      version: branch.version,
      input: {
        name: String(form.get('name')).trim(),
        address: text('address'),
        phone: text('phone'),
      },
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Details</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
          <RequestErrorAlert error={error} />
          {update.isSuccess && <Alert tone="success">Saved.</Alert>}
          <fieldset disabled={!editable} className="m-0 flex flex-col gap-4 border-0 p-0">
            <TextField
              label="Name"
              name="name"
              defaultValue={branch.name}
              error={error?.fields.name}
            />
            <TextField
              label="Address"
              name="address"
              defaultValue={branch.address ?? ''}
              error={error?.fields.address}
            />
            <TextField
              label="Phone"
              name="phone"
              type="tel"
              defaultValue={branch.phone ?? ''}
              hint="International format, e.g. +15550147123."
              error={error?.fields.phone}
            />
          </fieldset>
          {editable && (
            <Button type="submit" className="self-start" disabled={update.isPending}>
              {update.isPending ? 'Saving…' : 'Save details'}
            </Button>
          )}
        </form>
      </CardContent>
    </Card>
  );
}

interface DayDraft {
  open: boolean;
  opensAt: string;
  closesAt: string;
}

function HoursCard({ branch, editable }: Readonly<{ branch: Detail; editable: boolean }>) {
  const replace = useReplaceOpeningHours(branch.id);
  const [days, setDays] = useState<Record<number, DayDraft>>(() =>
    Object.fromEntries(
      WEEK_ORDER.map((weekday) => {
        const saved = branch.openingHours.find((h) => h.weekday === weekday);
        return [
          weekday,
          {
            open: !!saved,
            opensAt: saved?.opensAt ?? '09:00',
            closesAt: saved?.closesAt ?? '17:00',
          },
        ];
      }),
    ),
  );
  const hours = WEEK_ORDER.filter((d) => days[d]?.open).map((weekday) => ({
    weekday,
    opensAt: days[weekday]!.opensAt,
    closesAt: days[weekday]!.closesAt,
  }));
  const problems = openingHoursProblems(hours);
  const error = toRequestErrorView(replace.error);
  const set = (weekday: number, change: Partial<DayDraft>) =>
    setDays((current) => ({ ...current, [weekday]: { ...current[weekday]!, ...change } }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Opening hours</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (Object.keys(problems).length === 0) replace.mutate(hours);
          }}
        >
          <RequestErrorAlert error={error} />
          {replace.isSuccess && <Alert tone="success">Opening hours saved.</Alert>}
          <fieldset disabled={!editable} className="m-0 flex flex-col gap-2 border-0 p-0">
            <legend className="sr-only">Weekly opening hours</legend>
            {WEEK_ORDER.map((weekday) => {
              const day = days[weekday]!;
              const name = WEEKDAYS[weekday]!;
              return (
                <div
                  key={weekday}
                  className="flex flex-wrap items-center gap-3 rounded-xl bg-surface-muted/50 px-3 py-2"
                >
                  <label className="flex w-36 items-center gap-2.5 text-sm font-semibold">
                    <input
                      type="checkbox"
                      checked={day.open}
                      onChange={(e) => set(weekday, { open: e.target.checked })}
                      className="size-5 accent-primary"
                    />
                    {name}
                  </label>
                  {day.open ? (
                    <span className="flex items-center gap-2 text-sm">
                      <input
                        type="time"
                        step={900}
                        aria-label={`${name} opens`}
                        value={day.opensAt}
                        onChange={(e) => set(weekday, { opensAt: e.target.value })}
                        className="h-10 rounded-lg border border-border bg-surface px-2"
                      />
                      –
                      <input
                        type="time"
                        step={900}
                        aria-label={`${name} closes`}
                        value={day.closesAt}
                        onChange={(e) => set(weekday, { closesAt: e.target.value })}
                        className="h-10 rounded-lg border border-border bg-surface px-2"
                      />
                    </span>
                  ) : (
                    <span className="text-sm text-muted">Closed</span>
                  )}
                  {problems[weekday] && (
                    <span role="alert" className="w-full text-[13px] font-semibold text-danger">
                      {problems[weekday]}
                    </span>
                  )}
                </div>
              );
            })}
          </fieldset>
          {editable && (
            <Button
              type="submit"
              className="self-start"
              disabled={replace.isPending || Object.keys(problems).length > 0}
            >
              {replace.isPending ? 'Saving…' : 'Save opening hours'}
            </Button>
          )}
        </form>
      </CardContent>
    </Card>
  );
}

const dayFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});
const formatDay = (value: string) => dayFormat.format(new Date(`${value}T00:00:00Z`));

function ClosuresCard({ branch, editable }: Readonly<{ branch: Detail; editable: boolean }>) {
  const add = useAddClosure(branch.id);
  const remove = useRemoveClosure(branch.id);
  const error = toRequestErrorView(add.error ?? remove.error);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    add.mutate(
      {
        startsOn: String(form.get('startsOn')),
        endsOn: String(form.get('endsOn')),
        reason: String(form.get('reason')).trim(),
      },
      { onSuccess: () => formElement.reset() },
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Closures</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {branch.closures.length === 0 ? (
          <p className="text-sm text-muted">No upcoming closures.</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {branch.closures.map((closure) => (
              <li
                key={closure.id}
                className="flex items-center justify-between gap-3 rounded-xl bg-surface-muted/50 px-3 py-2.5"
              >
                <span>
                  <span className="block text-sm font-bold">{closure.reason}</span>
                  <span className="text-[13px] text-muted">
                    {closure.startsOn === closure.endsOn
                      ? formatDay(closure.startsOn)
                      : `${formatDay(closure.startsOn)} – ${formatDay(closure.endsOn)}`}
                  </span>
                </span>
                {editable && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(closure.id)}
                  >
                    Remove
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        {editable && (
          <form
            className="flex flex-col gap-3 border-t border-border pt-4"
            onSubmit={submit}
            noValidate
          >
            <RequestErrorAlert error={error} />
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField
                label="From"
                name="startsOn"
                type="date"
                required
                error={error?.fields.startsOn}
              />
              <TextField
                label="To"
                name="endsOn"
                type="date"
                required
                error={error?.fields.endsOn}
              />
            </div>
            <TextField
              label="Reason"
              name="reason"
              placeholder="e.g. Public holiday"
              required
              error={error?.fields.reason}
            />
            <Button
              type="submit"
              variant="secondary"
              className="self-start"
              disabled={add.isPending}
            >
              Add closure
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

function ArchiveCard({ branch }: Readonly<{ branch: Detail }>) {
  const archive = useArchiveBranch(branch.id);
  const [confirming, setConfirming] = useState(false);
  const error = toRequestErrorView(archive.error);

  return (
    <Card className="border-danger/40">
      <CardHeader>
        <CardTitle>Archive branch</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-start gap-3">
        <p className="text-sm text-muted">
          Archived branches disappear from booking and cannot be changed. Move or deactivate the
          members who work here first.
        </p>
        <RequestErrorAlert error={error} />
        <Button variant="danger" onClick={() => setConfirming(true)}>
          Archive {branch.name}
        </Button>
      </CardContent>
      <ConfirmDialog
        open={confirming}
        title={`Archive ${branch.name}?`}
        confirmLabel="Archive branch"
        destructive
        busy={archive.isPending}
        onCancel={() => setConfirming(false)}
        onConfirm={() => archive.mutate(undefined, { onSettled: () => setConfirming(false) })}
      >
        Open invitations to this branch are revoked. This cannot be undone from the Console.
      </ConfirmDialog>
    </Card>
  );
}
