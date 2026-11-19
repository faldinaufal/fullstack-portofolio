// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import { Alert, Button, Card, CardContent, CardHeader, CardTitle, TextField } from '@tempora/ui';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, type SubmitEvent } from 'react';
import {
  PASSWORD_MIN_LENGTH,
  useChangePassword,
  useCustomer,
  useLogoutEverywhere,
  useResendVerification,
  useRevokeSession,
  useSessions,
  useUpdateProfile,
  type Customer,
} from '@/core/account/presentation/use-account';
import { toRequestErrorView } from '@/core/shared/presentation/error-view';
import { formText } from '@/ui/common/form-values';
import { RequestErrorAlert } from '@/ui/common/request-error';

/** FSD 2.1 `/account/profile`: name, phone, password, active sessions. */
export function ProfileScreen() {
  const router = useRouter();
  const welcome = useSearchParams().get('welcome') === '1';
  const customer = useCustomer();

  useEffect(() => {
    if (customer.isSuccess && customer.data === null)
      router.replace('/login?next=/account/profile');
  }, [customer.isSuccess, customer.data, router]);

  if (!customer.data) {
    return (
      <main className="px-4 py-12 sm:px-6">
        <div className="mx-auto h-64 max-w-[760px] animate-pulse rounded-card bg-surface-muted" />
      </main>
    );
  }

  return (
    <main className="px-4 py-10 sm:px-6">
      <div className="mx-auto flex max-w-[760px] flex-col gap-6">
        <h1 className="text-[32px] leading-tight font-extrabold">Profile and security</h1>
        {welcome && <Alert tone="success">Welcome to Tempora, {customer.data.name}!</Alert>}
        {!customer.data.emailVerified && <VerifyBanner email={customer.data.email} />}
        {/* `key` resets the form after a save. */}
        <ProfileCard
          key={`${customer.data.name}|${customer.data.phone}`}
          customer={customer.data}
        />
        <PasswordCard />
        <SessionsCard />
      </div>
    </main>
  );
}

function VerifyBanner({ email }: Readonly<{ email: string }>) {
  const resend = useResendVerification();
  const error = toRequestErrorView(resend.error);
  return (
    <Alert tone="info" title="Confirm your email">
      We sent a link to {email}. Confirming it lets earlier guest bookings with this address appear
      in your account.
      <span className="mt-2 flex flex-wrap items-center gap-3">
        <Button
          size="sm"
          variant="secondary"
          disabled={resend.isPending || resend.isSuccess}
          onClick={() => resend.mutate()}
        >
          {resend.isSuccess ? 'Sent' : 'Send the link again'}
        </Button>
        {error && <span className="text-danger">{error.message}</span>}
      </span>
    </Alert>
  );
}

function ProfileCard({ customer }: Readonly<{ customer: Customer }>) {
  const update = useUpdateProfile();
  const error = toRequestErrorView(update.error);

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    update.mutate({
      name: formText(form, 'name').trim(),
      phone: formText(form, 'phone').trim() || null,
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your details</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
          <RequestErrorAlert error={error} />
          {update.isSuccess && <Alert tone="success">Saved.</Alert>}
          <TextField
            label="Email"
            name="email"
            value={customer.email}
            readOnly
            hint="Your login; it cannot be changed here."
          />
          <TextField
            label="Name"
            name="name"
            defaultValue={customer.name}
            autoComplete="name"
            error={error?.fields.name}
          />
          <TextField
            label="Phone"
            name="phone"
            type="tel"
            defaultValue={customer.phone ?? ''}
            placeholder="+15550147123"
            error={error?.fields.phone}
          />
          <Button type="submit" className="self-start" disabled={update.isPending}>
            {update.isPending ? 'Saving…' : 'Save details'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function PasswordCard() {
  const change = useChangePassword();
  const error = toRequestErrorView(change.error);

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    change.mutate(
      {
        currentPassword: formText(form, 'currentPassword'),
        newPassword: formText(form, 'newPassword'),
      },
      { onSuccess: () => formElement.reset() },
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Password</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
          <RequestErrorAlert error={error} />
          {change.isSuccess && (
            <Alert tone="success">Password changed. Other devices were logged out.</Alert>
          )}
          <TextField
            label="Current password"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            error={error?.fields.currentPassword}
          />
          <TextField
            label="New password"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            hint={`At least ${PASSWORD_MIN_LENGTH} characters.`}
            error={error?.fields.newPassword}
          />
          <Button type="submit" className="self-start" disabled={change.isPending}>
            {change.isPending ? 'Saving…' : 'Change password'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function SessionsCard() {
  const router = useRouter();
  const sessions = useSessions();
  const revoke = useRevokeSession();
  const everywhere = useLogoutEverywhere();
  const error = toRequestErrorView(sessions.error ?? revoke.error ?? everywhere.error);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Where you are logged in</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <RequestErrorAlert error={error} />
        {sessions.data?.map((session) => (
          <div
            key={session.id}
            className="flex items-center justify-between gap-3 rounded-xl bg-surface-muted/50 px-4 py-3"
          >
            <span>
              <span className="block font-bold">{session.device}</span>
              <span className="text-[13px] text-muted">{session.detail}</span>
            </span>
            {!session.current && (
              <Button
                variant="ghost"
                size="sm"
                disabled={revoke.isPending}
                onClick={() => revoke.mutate(session.id)}
              >
                Log out
              </Button>
            )}
          </div>
        ))}
        <Button
          variant="secondary"
          className="self-start"
          disabled={everywhere.isPending}
          onClick={() =>
            everywhere.mutate(undefined, { onSuccess: () => router.replace('/login') })
          }
        >
          Log out everywhere
        </Button>
      </CardContent>
    </Card>
  );
}
