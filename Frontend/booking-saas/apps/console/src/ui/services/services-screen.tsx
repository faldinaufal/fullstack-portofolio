// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import { Badge, Button, Card, ConfirmDialog, Icon, TextField } from '@tempora/ui';
import { useState, type SubmitEvent } from 'react';
import { useCurrentMember } from '@/core/auth/presentation/use-auth';
import {
  parseDollars,
  serviceProblems,
  useArchiveService,
  useCreateService,
  useServices,
  useUpdateService,
  type ServiceRow,
} from '@/core/catalogue/presentation/use-catalogue';
import { toRequestErrorView } from '@/core/shared/presentation/error-view';
import { PageHeader } from '@/ui/common/page-header';
import { RequestErrorAlert } from '@/ui/common/request-error';
import { SidePanel } from '@/ui/common/side-panel';
import { formText } from '@/ui/common/form-values';

/** FSD 2.2 Services: the owner edits the catalogue; managers and staff read it. */
export function ServicesScreen() {
  const me = useCurrentMember();
  const services = useServices();
  const [editing, setEditing] = useState<ServiceRow | 'new' | null>(null);
  const [archiving, setArchiving] = useState<ServiceRow | null>(null);
  const archive = useArchiveService();
  const isOwner = me.role === 'owner';

  return (
    <>
      <PageHeader
        title="Services"
        description="What customers can book, with duration, buffer and price."
        actions={
          isOwner && (
            <Button onClick={() => setEditing('new')}>
              <Icon name="plus" size={18} /> New service
            </Button>
          )
        }
      />
      <RequestErrorAlert error={toRequestErrorView(services.error ?? archive.error)} />
      {services.isPending && <div className="h-40 animate-pulse rounded-card bg-surface-muted" />}

      {services.data?.length === 0 && (
        <Card className="flex flex-col items-start gap-3 p-6">
          <p className="text-lg font-extrabold">No services yet</p>
          <p className="text-sm text-muted">
            Add what you offer. Therapists are then assigned the services they perform.
          </p>
          {isOwner && <Button onClick={() => setEditing('new')}>Add a service</Button>}
        </Card>
      )}

      {services.data && services.data.length > 0 && (
        <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4 p-0">
          {services.data.map((service) => (
            <li key={service.id}>
              <Card className="flex h-full flex-col gap-2 p-5">
                <span className="flex items-start justify-between gap-2">
                  <span className="text-lg font-extrabold">{service.name}</span>
                  <span className="text-lg font-extrabold text-primary-text">{service.price}</span>
                </span>
                <span className="text-sm text-muted">{service.timing}</span>
                {service.description && <span className="text-sm">{service.description}</span>}
                <span className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2">
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-primary-text">
                    <Icon name="team" size={16} /> {service.therapistsLabel}
                  </span>
                  {service.archived ? (
                    <Badge tone="neutral">Archived</Badge>
                  ) : (
                    isOwner && (
                      <span className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setEditing(service)}>
                          Edit
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setArchiving(service)}>
                          Archive
                        </Button>
                      </span>
                    )
                  )}
                </span>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <ServicePanel
          service={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
      <ConfirmDialog
        open={archiving !== null}
        title={`Archive ${archiving?.name ?? ''}?`}
        confirmLabel="Archive service"
        destructive
        busy={archive.isPending}
        onCancel={() => setArchiving(null)}
        onConfirm={() =>
          archiving && archive.mutate(archiving.id, { onSettled: () => setArchiving(null) })
        }
      >
        Customers can no longer book it and therapists stop offering it. Past bookings keep their
        details.
      </ConfirmDialog>
    </>
  );
}

/** Create or edit a service; price is entered in dollars and sent as cents. */
export function ServiceForm({
  service,
  onSaved,
  submitLabel,
}: Readonly<{ service: ServiceRow | null; onSaved?: () => void; submitLabel?: string }>) {
  const create = useCreateService();
  const update = useUpdateService();
  const [problems, setProblems] = useState<Record<string, string>>({});
  const mutation = service ? update : create;
  const error = toRequestErrorView(mutation.error, {
    VERSION_CONFLICT: 'Someone else changed this service in the meantime. Reload and try again.',
  });
  const field = (name: string) => problems[name] ?? error?.fields[name];
  const defaultLabel = service ? 'Save service' : 'Create service';
  const idleLabel = submitLabel ?? defaultLabel;

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const input = {
      name: formText(form, 'name').trim(),
      description: formText(form, 'description').trim() || null,
      durationMinutes: Number(form.get('durationMinutes')),
      bufferMinutes: Number(form.get('bufferMinutes')),
      priceCents: parseDollars(formText(form, 'price')),
    };
    const found = serviceProblems(input);
    if (Number.isNaN(input.priceCents)) found.priceCents = 'Enter a price such as 42.17.';
    setProblems(found);
    if (Object.keys(found).length > 0) return;
    const done = {
      onSuccess: () => {
        if (!service) formElement.reset();
        onSaved?.();
      },
    };
    if (service) update.mutate({ id: service.id, version: service.version, input }, done);
    else create.mutate(input, done);
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
      <RequestErrorAlert error={error} />
      <TextField label="Name" name="name" defaultValue={service?.name} error={field('name')} />
      <TextField
        label="Description (optional)"
        name="description"
        defaultValue={service?.description ?? ''}
        error={field('description')}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField
          label="Duration (minutes)"
          name="durationMinutes"
          type="number"
          min={15}
          max={480}
          step={15}
          defaultValue={service?.durationMinutes ?? 60}
          error={field('durationMinutes')}
        />
        <TextField
          label="Buffer after (minutes)"
          name="bufferMinutes"
          type="number"
          min={0}
          max={60}
          step={5}
          defaultValue={service?.bufferMinutes ?? 10}
          hint="Cleanup time; not shown to customers."
          error={field('bufferMinutes')}
        />
      </div>
      <TextField
        label="Price (USD)"
        name="price"
        inputMode="decimal"
        defaultValue={service ? (service.priceCents / 100).toFixed(2) : ''}
        placeholder="42.17"
        hint={service ? 'A new price applies to new bookings only.' : undefined}
        error={field('priceCents')}
      />
      <Button type="submit" size="lg" disabled={mutation.isPending}>
        {mutation.isPending ? 'Saving…' : idleLabel}
      </Button>
    </form>
  );
}

function ServicePanel({
  service,
  onClose,
}: Readonly<{ service: ServiceRow | null; onClose: () => void }>) {
  return (
    <SidePanel open title={service ? `Edit ${service.name}` : 'New service'} onClose={onClose}>
      <ServiceForm service={service} onSaved={onClose} />
    </SidePanel>
  );
}
