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
  Icon,
  TextField,
} from '@tempora/ui';
import Link from 'next/link';
import { useState, type SubmitEvent } from 'react';
import { useCurrentMember } from '@/core/auth/presentation/use-auth';
import { useServices } from '@/core/catalogue/presentation/use-catalogue';
import { toRequestErrorView } from '@/core/shared/presentation/error-view';
import {
  useAddTimeOff,
  useMember,
  useRemoveTimeOff,
  useReplaceMemberServices,
  useReplaceWorkingHours,
  workingHoursProblems,
} from '@/core/team/presentation/use-team';
import { PageHeader } from '@/ui/common/page-header';
import { RequestErrorAlert } from '@/ui/common/request-error';
import { useWeekHours, WeekHoursEditor } from '@/ui/common/week-hours-editor';
import { formText } from '@/ui/common/form-values';

type Detail = NonNullable<ReturnType<typeof useMember>['data']>;

/**
 * FSD 2.2 Team member detail (`/team/[id]`) and My schedule (`/schedule`, the signed-in
 * staff member's own page): working hours, services performed, time off.
 */
export function MemberDetailScreen({ id, mine = false }: Readonly<{ id: string; mine?: boolean }>) {
  const me = useCurrentMember();
  const member = useMember(id, me);

  return (
    <>
      {!mine && (
        <Link
          href="/team"
          className="flex items-center gap-1.5 text-sm font-semibold text-primary-text"
        >
          <Icon name="chevron-left" size={16} /> Team
        </Link>
      )}
      {member.isPending && <div className="h-64 animate-pulse rounded-card bg-surface-muted" />}
      <RequestErrorAlert error={toRequestErrorView(member.error)} />
      {member.data && (
        <>
          <PageHeader
            title={mine ? 'My schedule' : member.data.name}
            description={`${member.data.row.roleLabel} · ${member.data.row.branchName}`}
            actions={!member.data.row.active && <Badge tone="neutral">Deactivated</Badge>}
          />
          {!member.data.therapist ? (
            <Alert tone="info">
              Owners work across the whole business and have no working hours or services here.
            </Alert>
          ) : (
            <div className="grid gap-[22px] xl:grid-cols-2">
              <WorkingHoursCard
                key={`hours-${member.data.workingHours.length}`}
                member={member.data}
              />
              <MemberServicesCard member={member.data} />
              <TimeOffCard member={member.data} />
            </div>
          )}
        </>
      )}
    </>
  );
}

function WorkingHoursCard({ member }: Readonly<{ member: Detail }>) {
  const replace = useReplaceWorkingHours(member.id);
  const week = useWeekHours(
    member.workingHours.map((h) => ({ weekday: h.weekday, start: h.startsAt, end: h.endsAt })),
  );
  const problems = workingHoursProblems(week.hours);
  const error = toRequestErrorView(replace.error, {
    OUTSIDE_BRANCH_HOURS:
      'Some days fall outside the branch opening hours (or the branch is closed then).',
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Working hours</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (Object.keys(problems).length > 0) return;
            replace.mutate(
              week.hours.map((h) => ({ weekday: h.weekday, startsAt: h.start, endsAt: h.end })),
            );
          }}
        >
          <RequestErrorAlert error={error} />
          {replace.isSuccess && <Alert tone="success">Working hours saved.</Alert>}
          <WeekHoursEditor
            legend="Weekly working hours"
            days={week.days}
            set={week.set}
            problems={problems}
            disabled={!member.canEditSchedule}
            closedLabel="Not working"
          />
          {member.canEditSchedule ? (
            <Button
              type="submit"
              className="self-start"
              disabled={replace.isPending || Object.keys(problems).length > 0}
            >
              {replace.isPending ? 'Saving…' : 'Save working hours'}
            </Button>
          ) : (
            <p className="text-[13px] text-muted">Your owner or manager sets your working hours.</p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}

function MemberServicesCard({ member }: Readonly<{ member: Detail }>) {
  const services = useServices();
  const replace = useReplaceMemberServices(member.id);
  const [selected, setSelected] = useState(() => new Set(member.services.map((s) => s.id)));
  const active = (services.data ?? []).filter((service) => !service.archived);
  const error = toRequestErrorView(replace.error);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Services performed</CardTitle>
      </CardHeader>
      <CardContent>
        {!member.canEditSchedule && <AssignedServices services={member.services} />}
        {member.canEditSchedule && active.length === 0 && (
          <Alert tone="info">
            The catalogue is empty. The owner adds services under{' '}
            <Link href="/services" className="font-bold text-primary-text">
              Services
            </Link>
            .
          </Alert>
        )}
        {member.canEditSchedule && active.length > 0 && (
          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              replace.mutate([...selected]);
            }}
          >
            <RequestErrorAlert error={error} />
            {replace.isSuccess && <Alert tone="success">Services saved.</Alert>}
            <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
              <legend className="sr-only">Services this therapist performs</legend>
              {active.map((service) => (
                <label
                  key={service.id}
                  className="flex items-center gap-3 rounded-xl bg-surface-muted/50 px-3 py-2.5 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(service.id)}
                    onChange={(e) =>
                      setSelected((current) => {
                        const next = new Set(current);
                        if (e.target.checked) next.add(service.id);
                        else next.delete(service.id);
                        return next;
                      })
                    }
                    className="size-5 accent-primary"
                  />
                  <span className="flex-1 font-semibold">{service.name}</span>
                  <span className="text-muted">{service.timing}</span>
                </label>
              ))}
            </fieldset>
            <Button type="submit" className="self-start" disabled={replace.isPending}>
              {replace.isPending ? 'Saving…' : 'Save services'}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

function AssignedServices({ services }: Readonly<{ services: { id: string; name: string }[] }>) {
  if (services.length === 0) return <p className="text-sm text-muted">No services assigned yet.</p>;
  return (
    <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
      {services.map((service) => (
        <li key={service.id}>
          <Badge tone="info">{service.name}</Badge>
        </li>
      ))}
    </ul>
  );
}

function TimeOffCard({ member }: Readonly<{ member: Detail }>) {
  const add = useAddTimeOff(member.id);
  const remove = useRemoveTimeOff(member.id);
  const error = toRequestErrorView(add.error ?? remove.error);

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    // datetime-local values are local wall-clock times; Date reads them in the browser's zone.
    const reason = formText(form, 'reason').trim();
    add.mutate(
      {
        startsAt: new Date(formText(form, 'startsAt')),
        endsAt: new Date(formText(form, 'endsAt')),
        ...(reason && { reason }),
      },
      { onSuccess: () => formElement.reset() },
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Time off</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {member.timeOffRows.length === 0 ? (
          <p className="text-sm text-muted">No upcoming time off.</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {member.timeOffRows.map((entry) => (
              <li
                key={entry.id}
                className="flex items-center justify-between gap-3 rounded-xl bg-surface-muted/50 px-3 py-2.5"
              >
                <span>
                  <span className="block text-sm font-bold">{entry.reason}</span>
                  <span className="text-[13px] text-muted">{entry.period}</span>
                </span>
                {member.canManageTimeOff && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(entry.id)}
                  >
                    Remove
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        {member.canManageTimeOff && (
          <form
            className="flex flex-col gap-3 border-t border-border pt-4"
            onSubmit={submit}
            noValidate
          >
            <RequestErrorAlert error={error} />
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField label="From" name="startsAt" type="datetime-local" step={900} required />
              <TextField
                label="Until"
                name="endsAt"
                type="datetime-local"
                step={900}
                required
                error={error?.fields.endsAt}
              />
            </div>
            <TextField label="Reason (optional)" name="reason" placeholder="e.g. Training day" />
            <Button
              type="submit"
              variant="secondary"
              className="self-start"
              disabled={add.isPending}
            >
              Add time off
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
