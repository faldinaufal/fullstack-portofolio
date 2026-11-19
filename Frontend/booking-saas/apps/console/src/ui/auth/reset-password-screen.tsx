// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import { Alert, Button, buttonVariants, TextField } from '@tempora/ui';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState, type SubmitEvent } from 'react';
import { toErrorView } from '@/core/auth/presentation/auth-messages';
import {
  PASSWORD_MIN_LENGTH,
  validateNewPassword,
  type FieldErrors,
} from '@/core/auth/presentation/password-forms';
import { useResetPassword } from '@/core/auth/presentation/use-auth';
import { AuthLayout } from './auth-layout';
import { FormError } from './form-error';
import { formText } from '@/ui/common/form-values';

/** Opened from the emailed link `/reset-password?token=...`. */
export function ResetPasswordScreen() {
  const token = useSearchParams().get('token') ?? '';
  const reset = useResetPassword();
  const [localErrors, setLocalErrors] = useState<FieldErrors>({});
  const error = toErrorView(reset.error);

  if (reset.isSuccess) {
    return (
      <AuthLayout title="Password changed">
        <Alert tone="success">
          You were logged out on every device. Log in with your new password; we will ask for an
          email code.
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
    const password = formText(form, 'password');
    const errors = validateNewPassword(password, formText(form, 'confirmation'));
    setLocalErrors(errors);
    if (Object.keys(errors).length === 0) reset.mutate({ token, password });
  }

  return (
    <AuthLayout
      title="Choose a new password"
      description="This ends every session and forgets trusted devices."
      footer={
        <Link href="/forgot-password" className="font-bold text-primary-text">
          Request a new link
        </Link>
      }
    >
      {token ? (
        <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
          <FormError error={error} />
          <TextField
            label="New password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            hint={`At least ${PASSWORD_MIN_LENGTH} characters.`}
            error={localErrors.password ?? error?.fields.password}
          />
          <TextField
            label="Repeat new password"
            name="confirmation"
            type="password"
            autoComplete="new-password"
            required
            error={localErrors.confirmation}
          />
          <Button type="submit" size="lg" disabled={reset.isPending}>
            {reset.isPending ? 'Saving…' : 'Set new password'}
          </Button>
        </form>
      ) : (
        <Alert tone="danger">This link is incomplete. Open the link from the email again.</Alert>
      )}
    </AuthLayout>
  );
}
