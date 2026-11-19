// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import { Alert, Button, buttonVariants, TextField } from '@tempora/ui';
import Link from 'next/link';
import type { SubmitEvent } from 'react';
import { toRequestErrorView } from '@/core/shared/presentation/error-view';
import { useAcceptInvitation, useInvitationPreview } from '@/core/team/presentation/use-team';
import { RequestErrorAlert } from '@/ui/common/request-error';
import { AuthLayout } from './auth-layout';
import { formText } from '@/ui/common/form-values';

/** FSD 2.2 `/invite/[token]`: join a business from the emailed link. */
export function AcceptInvitationScreen({ token }: Readonly<{ token: string }>) {
  const preview = useInvitationPreview(token);
  const accept = useAcceptInvitation(token);
  const error = toRequestErrorView(accept.error, {
    INVALID_CREDENTIALS: 'That is not the password of your existing account.',
  });

  if (preview.isPending) {
    return (
      <AuthLayout title="Opening invitation…">
        <div className="h-32 animate-pulse rounded-card bg-surface-muted" />
      </AuthLayout>
    );
  }

  if (preview.isError) {
    return (
      <AuthLayout
        title="Invitation not valid"
        description="It expired, was revoked or was already used. Ask the person who invited you for a new one."
      >
        <Link href="/login" className={buttonVariants({ size: 'lg' })}>
          Go to log in
        </Link>
      </AuthLayout>
    );
  }

  const invitation = preview.data;

  if (accept.isSuccess) {
    return (
      <AuthLayout title={`Welcome to ${invitation.businessName}`}>
        <Alert tone="success">
          You joined as {invitation.roleLabel} {invitation.place}. Log in to start; we will email
          you a code.
        </Alert>
        <Link href="/login" className={buttonVariants({ size: 'lg' })}>
          Log in
        </Link>
      </AuthLayout>
    );
  }

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    accept.mutate({
      ...(!invitation.accountExists && { name: formText(form, 'name').trim() }),
      password: formText(form, 'password'),
    });
  }

  return (
    <AuthLayout
      title={`Join ${invitation.businessName}`}
      description={
        <>
          You are invited as <strong className="text-foreground">{invitation.roleLabel}</strong>{' '}
          {invitation.place} with <strong className="text-foreground">{invitation.email}</strong>.
        </>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
        <RequestErrorAlert error={error} />
        {invitation.accountExists ? (
          <>
            <p className="text-sm text-muted">
              You already have a Tempora Console account. Confirm with its password to add this
              business to it.
            </p>
            <TextField
              label="Password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              error={error?.fields.password}
            />
          </>
        ) : (
          <>
            <TextField
              label="Your name"
              name="name"
              autoComplete="name"
              required
              error={error?.fields.name}
            />
            <TextField
              label="Choose a password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              hint="At least 12 characters. A short sentence works well."
              error={error?.fields.password}
            />
          </>
        )}
        <Button type="submit" size="lg" disabled={accept.isPending}>
          {accept.isPending ? 'Joining…' : 'Accept invitation'}
        </Button>
      </form>
    </AuthLayout>
  );
}
