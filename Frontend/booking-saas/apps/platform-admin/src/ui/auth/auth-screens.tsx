// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import {
  Alert,
  Button,
  Card,
  CardContent,
  DemoAccounts,
  DemoInboxNotice,
  fillLoginForm,
  TemporaMark,
  TextField,
} from '@tempora/ui';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode, type SubmitEvent } from 'react';
import {
  useAdminSession,
  useLogin,
  useResendCode,
  useVerifyLogin,
} from '@/core/auth/presentation/use-admin-auth';
import {
  DEMO_ACCOUNTS,
  DEMO_INBOX_URL,
  DEMO_MODE,
  DEMO_PASSWORD,
  isDemoAddress,
} from '@/core/shared/presentation/demo';
import { toRequestErrorView } from '@/core/shared/presentation/error-view';
import { RequestErrorAlert } from '@/ui/common/request-error';

function AuthLayout({
  title,
  description,
  children,
}: Readonly<{ title: string; description: ReactNode; children: ReactNode }>) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-4">
      <Card className="w-full max-w-[420px]">
        <CardContent className="flex flex-col gap-5 p-7">
          <span className="flex items-center gap-2.5 font-extrabold text-primary-text">
            <TemporaMark /> Tempora Platform Admin
          </span>
          <div>
            <h1 className="text-2xl font-extrabold">{title}</h1>
            <p className="mt-1 text-sm text-muted">{description}</p>
          </div>
          {children}
        </CardContent>
      </Card>
    </main>
  );
}

/** FSD 2.3 `/login`: email and password, then always the code step. */
export function LoginScreen() {
  const router = useRouter();
  const session = useAdminSession();
  const login = useLogin();
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (session.status === 'signed-in') router.replace('/');
  }, [session.status, router]);

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    login.mutate(
      { email: String(form.get('email') ?? ''), password: String(form.get('password') ?? '') },
      {
        onSuccess: (challenge) =>
          router.push(
            `/login/verify?${new URLSearchParams({ challenge: challenge.id, to: challenge.sentTo })}`,
          ),
      },
    );
  }

  return (
    <AuthLayout title="Log in" description="Operators only. A code is emailed at every login.">
      <form ref={formRef} className="flex flex-col gap-4" onSubmit={submit}>
        <RequestErrorAlert error={toRequestErrorView(login.error)} />
        <TextField label="Email" name="email" type="email" autoComplete="username" required />
        <TextField
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
        <Button type="submit" size="lg" disabled={login.isPending}>
          {login.isPending ? 'Checking…' : 'Continue'}
        </Button>
      </form>
      {DEMO_MODE && (
        <DemoAccounts
          accounts={DEMO_ACCOUNTS}
          password={DEMO_PASSWORD}
          inboxUrl={DEMO_INBOX_URL}
          onUse={(account, password) => fillLoginForm(formRef.current, account.email, password)}
        />
      )}
    </AuthLayout>
  );
}

/** FSD 2.3 `/login/verify`: the 6-digit code from the email. */
export function VerifyScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const challengeId = params.get('challenge');
  const sentTo = params.get('to') ?? 'your email address';
  const verify = useVerifyLogin();
  const resend = useResendCode();
  const [code, setCode] = useState('');

  if (!challengeId) {
    return (
      <AuthLayout title="No login in progress" description="Start again to receive a code.">
        <Link href="/login" className="font-semibold text-primary-text">
          Go to log in
        </Link>
      </AuthLayout>
    );
  }

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    verify.mutate({ challengeId: challengeId!, code }, { onSuccess: () => router.replace('/') });
  }

  return (
    <AuthLayout
      title="Check your email"
      description={
        <>
          If the details were right, a 6-digit code is on its way to{' '}
          <strong className="text-foreground">{sentTo}</strong>. It expires in 10 minutes.
        </>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={submit}>
        <RequestErrorAlert error={toRequestErrorView(verify.error)} />
        {isDemoAddress(sentTo) && <DemoInboxNotice href={DEMO_INBOX_URL} />}
        {resend.isSuccess && (
          <Alert tone="success">If a code was sent, a new one is on its way.</Alert>
        )}
        <TextField
          label="Code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          required
        />
        <Button type="submit" size="lg" disabled={verify.isPending || code.length !== 6}>
          {verify.isPending ? 'Verifying…' : 'Log in'}
        </Button>
        <div className="flex justify-between text-sm">
          <button
            type="button"
            className="font-semibold text-primary-text"
            disabled={resend.isPending}
            onClick={() => resend.mutate(challengeId)}
          >
            Send a new code
          </button>
          <Link href="/login" className="font-semibold text-primary-text">
            Start again
          </Link>
        </div>
      </form>
    </AuthLayout>
  );
}
