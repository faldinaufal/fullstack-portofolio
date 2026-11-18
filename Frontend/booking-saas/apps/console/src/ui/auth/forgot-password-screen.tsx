// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import { Alert, Button, TextField } from '@tempora/ui';
import Link from 'next/link';
import type { FormEvent } from 'react';
import { toErrorView } from '@/core/auth/presentation/auth-messages';
import { useRequestPasswordReset } from '@/core/auth/presentation/use-auth';
import { AuthLayout } from './auth-layout';
import { FormError } from './form-error';

export function ForgotPasswordScreen() {
  const request = useRequestPasswordReset();
  const error = toErrorView(request.error);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    request.mutate(String(new FormData(event.currentTarget).get('email')));
  }

  return (
    <AuthLayout
      title="Reset your password"
      description="Enter your email and we will send you a link to choose a new password."
      footer={
        <Link href="/login" className="font-bold text-primary-text">
          Back to log in
        </Link>
      }
    >
      {request.isSuccess ? (
        // Same message whether or not the account exists (no account enumeration, FSD 6.11).
        <Alert tone="success" title="Check your email">
          If an account exists for that address, a reset link is on its way. It is valid for one
          hour.
        </Alert>
      ) : (
        <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
          <FormError error={error} />
          <TextField
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            required
            error={error?.fields.email}
          />
          <Button type="submit" size="lg" disabled={request.isPending}>
            {request.isPending ? 'Sending…' : 'Send reset link'}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
