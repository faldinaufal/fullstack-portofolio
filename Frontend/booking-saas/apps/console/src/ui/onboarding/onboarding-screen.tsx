// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import { Alert, Button, buttonVariants, Card, CardContent, Icon, TextField } from '@tempora/ui';
import Link from 'next/link';
import { useState, type SubmitEvent } from 'react';
import { useBranch, useBranches, useCreateBranch } from '@/core/branches/presentation/use-branches';
import { useBusinessSettings, useServices } from '@/core/catalogue/presentation/use-catalogue';
import { toRequestErrorView } from '@/core/shared/presentation/error-view';
import { HoursCard } from '@/ui/branches/branch-detail-screen';
import { formText } from '@/ui/common/form-values';
import { PageHeader } from '@/ui/common/page-header';
import { RequestErrorAlert } from '@/ui/common/request-error';
import { ServiceForm } from '@/ui/services/services-screen';
import { BusinessSettingsForm } from '@/ui/settings/settings-screen';

const STEPS = ['Business', 'First branch', 'Services', 'Team'] as const;

/**
 * FSD 3.4 step 2: business profile → first branch and hours → services → invite team.
 * Every step saves through the same endpoints as the regular screens, so leaving halfway
 * loses nothing; the dashboard shows what is still missing.
 */
export function OnboardingScreen() {
  const [step, setStep] = useState(0);
  const next = () => setStep((current) => Math.min(current + 1, STEPS.length - 1));

  return (
    <>
      <PageHeader
        title="Set up your business"
        description="Four short steps, then customers can book you on the Portal."
      />
      <ol className="m-0 flex list-none flex-wrap gap-2 p-0" aria-label="Setup steps">
        {STEPS.map((label, index) => (
          <li key={label}>
            <button
              type="button"
              onClick={() => setStep(index)}
              aria-current={index === step ? 'step' : undefined}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${
                index === step
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-surface-muted text-foreground'
              }`}
            >
              <span aria-hidden="true">{index < step ? '✓' : index + 1}</span> {label}
            </button>
          </li>
        ))}
      </ol>
      <div className="max-w-[760px]">
        {step === 0 && <BusinessStep onDone={next} />}
        {step === 1 && <BranchStep onDone={next} />}
        {step === 2 && <ServicesStep onDone={next} />}
        {step === 3 && <TeamStep />}
      </div>
    </>
  );
}

function BusinessStep({ onDone }: Readonly<{ onDone: () => void }>) {
  const settings = useBusinessSettings();
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 pt-6">
        <p className="text-sm text-muted">
          Check your business name and how far ahead and how late customers can book. You can change
          these later in Settings.
        </p>
        {settings.data && (
          <BusinessSettingsForm
            key={settings.data.version}
            settings={settings.data}
            submitLabel="Save and continue"
            onSaved={onDone}
          />
        )}
      </CardContent>
    </Card>
  );
}

function BranchStep({ onDone }: Readonly<{ onDone: () => void }>) {
  const branches = useBranches();
  const first = branches.data?.find((branch) => !branch.archived);
  const create = useCreateBranch();
  const error = toRequestErrorView(create.error);

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    create.mutate({
      name: formText(form, 'name').trim(),
      address: formText(form, 'address').trim() || null,
      phone: formText(form, 'phone').trim() || null,
    });
  }

  if (branches.isPending)
    return <div className="h-40 animate-pulse rounded-card bg-surface-muted" />;

  if (!first) {
    return (
      <Card>
        <CardContent className="pt-6">
          <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
            <p className="text-sm text-muted">Where do customers come for their sessions?</p>
            <RequestErrorAlert error={error} />
            <TextField
              label="Branch name"
              name="name"
              placeholder="e.g. Downtown"
              error={error?.fields.name}
            />
            <TextField label="Address" name="address" error={error?.fields.address} />
            <TextField
              label="Phone"
              name="phone"
              type="tel"
              placeholder="+15550147123"
              error={error?.fields.phone}
            />
            <Button type="submit" size="lg" className="self-start" disabled={create.isPending}>
              {create.isPending ? 'Creating…' : 'Create branch'}
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }
  return <FirstBranchHours branchId={first.id} onDone={onDone} />;
}

function FirstBranchHours({
  branchId,
  onDone,
}: Readonly<{ branchId: string; onDone: () => void }>) {
  const branch = useBranch(branchId);
  if (!branch.data) return <div className="h-40 animate-pulse rounded-card bg-surface-muted" />;
  return (
    <div className="flex flex-col gap-4">
      <Alert tone="success">
        {branch.data.name} is ready. Set the days and hours it is open; more branches can be added
        under Branches.
      </Alert>
      <HoursCard key={branch.data.version} branch={branch.data} editable />
      <Button
        className="self-start"
        onClick={onDone}
        disabled={branch.data.openingHours.length === 0}
      >
        Continue <Icon name="arrow-right" size={18} />
      </Button>
    </div>
  );
}

function ServicesStep({ onDone }: Readonly<{ onDone: () => void }>) {
  const services = useServices();
  const active = (services.data ?? []).filter((service) => !service.archived);
  return (
    <div className="flex flex-col gap-4">
      {active.length > 0 && (
        <Card>
          <CardContent className="flex flex-col gap-2 pt-6">
            {active.map((service) => (
              <p key={service.id} className="flex justify-between gap-3 text-sm">
                <span className="font-semibold">{service.name}</span>
                <span className="text-muted">
                  {service.timing} · {service.price}
                </span>
              </p>
            ))}
          </CardContent>
        </Card>
      )}
      <Card>
        <CardContent className="pt-6">
          <ServiceForm service={null} submitLabel="Add service" />
        </CardContent>
      </Card>
      <Button className="self-start" onClick={onDone} disabled={active.length === 0}>
        Continue <Icon name="arrow-right" size={18} />
      </Button>
    </div>
  );
}

function TeamStep() {
  const settings = useBusinessSettings();
  const setup = settings.data?.setup;
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 pt-6">
        <p className="text-sm text-muted">
          Invite the therapists who work at your branch. Each one needs working hours and the
          services they perform before customers can book them.
        </p>
        <SetupChecklist setup={setup} />
        <div className="flex flex-wrap gap-2">
          <Link href="/team" className={buttonVariants()}>
            Invite your team
          </Link>
          <Link href="/" className={buttonVariants({ variant: 'secondary' })}>
            Go to the dashboard
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

type Setup = NonNullable<ReturnType<typeof useBusinessSettings>['data']>['setup'];

/** The three conditions for appearing on the Portal (FSD 3.4 step 3). */
export function SetupChecklist({ setup }: Readonly<{ setup: Setup | undefined }>) {
  if (!setup) return null;
  const items = [
    { done: setup.hasBranch, label: 'A branch' },
    { done: setup.hasService, label: 'At least one service' },
    { done: setup.hasBookableTherapist, label: 'A therapist with working hours and services' },
  ];
  return (
    <ul className="m-0 flex list-none flex-col gap-2 p-0">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-2.5 text-sm">
          <span
            className={`flex size-6 items-center justify-center rounded-full ${
              item.done ? 'bg-success-soft text-success' : 'bg-surface-muted text-muted'
            }`}
          >
            <Icon name={item.done ? 'check' : 'clock'} size={14} />
          </span>
          <span className={item.done ? 'text-muted line-through' : 'font-semibold'}>
            {item.label}
          </span>
          <span className="sr-only">{item.done ? '(done)' : '(to do)'}</span>
        </li>
      ))}
    </ul>
  );
}
