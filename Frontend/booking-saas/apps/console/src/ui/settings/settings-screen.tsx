// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import { Alert, Button, Card, CardContent, CardHeader, CardTitle, TextField } from '@tempora/ui';
import type { SubmitEvent } from 'react';
import {
  LIMITS,
  useBusinessSettings,
  useUpdateBusinessSettings,
} from '@/core/catalogue/presentation/use-catalogue';
import { toRequestErrorView } from '@/core/shared/presentation/error-view';
import { formText } from '@/ui/common/form-values';
import { PageHeader } from '@/ui/common/page-header';
import { RequestErrorAlert } from '@/ui/common/request-error';

type Settings = NonNullable<ReturnType<typeof useBusinessSettings>['data']>;

/** FSD 2.2 Settings (owner): business name and booking settings (FSD 6.1). */
export function SettingsScreen() {
  const settings = useBusinessSettings();
  return (
    <>
      <PageHeader title="Settings" description="Your business profile and booking rules." />
      {settings.isPending && <div className="h-64 animate-pulse rounded-card bg-surface-muted" />}
      <RequestErrorAlert error={toRequestErrorView(settings.error)} />
      {settings.data && (
        <Card className="max-w-[720px]">
          <CardHeader>
            <CardTitle>Business and booking rules</CardTitle>
          </CardHeader>
          <CardContent>
            {/* `key` reloads the form with the saved values after each save. */}
            <BusinessSettingsForm key={settings.data.version} settings={settings.data} />
          </CardContent>
        </Card>
      )}
    </>
  );
}

const NUMBER_FIELDS = [
  {
    name: 'minLeadHours',
    label: 'Minimum notice (hours)',
    hint: 'How long before a session customers must book.',
  },
  {
    name: 'maxAdvanceDays',
    label: 'Booking horizon (days)',
    hint: 'How far ahead customers can book.',
  },
  {
    name: 'cancellationCutoffHours',
    label: 'Reschedule cut-off (hours)',
    hint: 'Customers can reschedule until this long before the session.',
  },
  {
    name: 'maxCustomerReschedules',
    label: 'Reschedules per booking',
    hint: 'After that, only you or a manager can move it.',
  },
] as const;

/** Shared by Settings and the onboarding wizard. */
export function BusinessSettingsForm({
  settings,
  submitLabel = 'Save settings',
  onSaved,
}: Readonly<{ settings: Settings; submitLabel?: string; onSaved?: () => void }>) {
  const update = useUpdateBusinessSettings();
  const error = toRequestErrorView(update.error, {
    VERSION_CONFLICT: 'These settings were changed in the meantime. Reload the page and try again.',
  });

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const number = (name: string) => Number(formText(form, name));
    update.mutate(
      {
        version: settings.version,
        input: {
          name: formText(form, 'name').trim(),
          bookingSettings: {
            minLeadHours: number('minLeadHours'),
            maxAdvanceDays: number('maxAdvanceDays'),
            cancellationCutoffHours: number('cancellationCutoffHours'),
            maxCustomerReschedules: number('maxCustomerReschedules'),
          },
        },
      },
      onSaved ? { onSuccess: onSaved } : undefined,
    );
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
      <RequestErrorAlert error={error} />
      {update.isSuccess && !onSaved && <Alert tone="success">Settings saved.</Alert>}
      <TextField
        label="Business name"
        name="name"
        defaultValue={settings.name}
        error={error?.fields.name}
      />
      <p className="text-[13px] text-muted">
        Booking page address:{' '}
        <span className="font-semibold text-foreground">/{settings.slug}</span>
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {NUMBER_FIELDS.map((field) => (
          <TextField
            key={field.name}
            label={field.label}
            name={field.name}
            type="number"
            min={LIMITS[field.name].min}
            max={LIMITS[field.name].max}
            defaultValue={settings.bookingSettings[field.name]}
            hint={`${field.hint} ${LIMITS[field.name].min}–${LIMITS[field.name].max}.`}
            error={error?.fields[`bookingSettings.${field.name}`]}
          />
        ))}
      </div>
      <Button type="submit" size="lg" className="self-start" disabled={update.isPending}>
        {update.isPending ? 'Saving…' : submitLabel}
      </Button>
    </form>
  );
}
