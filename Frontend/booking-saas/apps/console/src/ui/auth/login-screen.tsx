// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import { Button, DemoAccounts, fillLoginForm, TextField } from '@tempora/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, type SubmitEvent } from 'react';
import { toErrorView } from '@/core/auth/presentation/auth-messages';
import { useLogin, useSession } from '@/core/auth/presentation/use-auth';
import {
  DEMO_ACCOUNTS,
  DEMO_INBOX_URL,
  DEMO_MODE,
  DEMO_PASSWORD,
} from '@/core/shared/presentation/demo';
import { AuthLayout } from './auth-layout';
import { FormError } from './form-error';
import { formText } from '@/ui/common/form-values';

export function LoginScreen() {
  const router = useRouter();
  const session = useSession();
  const login = useLogin();
  const error = toErrorView(login.error);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (session.status === 'signed-in') router.replace('/');
  }, [session.status, router]);

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    login.mutate(
      { email: formText(form, 'email'), password: formText(form, 'password') },
      {
        onSuccess: (outcome) => router.push(outcome.kind === 'signed-in' ? '/' : '/login/verify'),
      },
    );
  }

  return (
    <AuthLayout
      title="Log in"
      description="Welcome back. We will email you a code to confirm it is you."
      footer={
        <>
          New to Tempora?{' '}
          <Link href="/signup" className="font-bold text-primary-text">
            Create a business account
          </Link>
        </>
      }
    >
      <form ref={formRef} className="flex flex-col gap-4" onSubmit={submit} noValidate>
        <FormError error={error} />
        <TextField
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          required
          error={error?.fields.email}
        />
        <TextField
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          labelAction={
            <Link href="/forgot-password" className="text-sm font-semibold text-primary-text">
              Forgot password?
            </Link>
          }
        />
        <Button type="submit" size="lg" disabled={login.isPending} className="mt-2">
          {login.isPending ? 'Checking…' : 'Continue'}
        </Button>
      </form>
      {DEMO_MODE && (
        <DemoAccounts
          className="mt-6"
          accounts={DEMO_ACCOUNTS}
          password={DEMO_PASSWORD}
          inboxUrl={DEMO_INBOX_URL}
          onUse={(account, password) => fillLoginForm(formRef.current, account.email, password)}
        />
      )}
    </AuthLayout>
  );
}
