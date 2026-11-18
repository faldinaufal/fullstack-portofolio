// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import { Alert, Button, buttonVariants, TextField } from '@tempora/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { toErrorView } from '@/core/auth/presentation/auth-messages';
import {
  useAbandonLogin,
  useCountdown,
  usePendingChallenge,
  useResendCode,
  useVerifyCode,
} from '@/core/auth/presentation/use-auth';
import { AuthLayout } from './auth-layout';
import { FormError } from './form-error';

/** Step 2 of login and sign-up: the 6-digit code from the email (FSD 2.2 `/login/verify`). */
export function VerifyCodeScreen() {
  const router = useRouter();
  const pending = usePendingChallenge();
  const verify = useVerifyCode();
  const resend = useResendCode();
  const abandon = useAbandonLogin();
  const [code, setCode] = useState('');
  const challenge = resend.data ?? pending.challenge;
  const resendIn = useCountdown(challenge?.resendAvailableAt);
  const error = toErrorView(verify.error);
  const resendError = toErrorView(resend.error);

  if (!pending.ready) return null;

  if (!challenge) {
    return (
      <AuthLayout title="No login in progress" description="Start again to receive a new code.">
        <Link href="/login" className={buttonVariants({ size: 'lg' })}>
          Go to log in
        </Link>
      </AuthLayout>
    );
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!challenge) return;
    const form = new FormData(event.currentTarget);
    verify.mutate(
      { challengeId: challenge.id, code, trustDevice: form.get('trustDevice') === 'on' },
      { onSuccess: () => router.replace('/') },
    );
  }

  return (
    <AuthLayout
      title="Check your email"
      description={
        <>
          We sent a 6-digit code to <strong className="text-foreground">{challenge.sentTo}</strong>.
          It expires in 10 minutes.
        </>
      }
      footer={
        <Link href="/login" onClick={abandon} className="font-bold text-primary-text">
          Use a different account
        </Link>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
        <FormError error={error} />
        {resend.isSuccess && !resend.isPending && (
          <Alert tone="success">A new code is on its way.</Alert>
        )}
        <TextField
          label="Code"
          name="code"
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          required
          autoFocus
          className="[&_input]:text-center [&_input]:text-2xl [&_input]:font-bold [&_input]:tracking-[0.5em]"
        />
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="trustDevice" className="mt-0.5 size-5 accent-primary" />
          <span>
            <span className="font-semibold">Trust this device for 30 days</span>
            <span className="block text-muted">
              Skip the code on this browser. Not on shared computers.
            </span>
          </span>
        </label>
        {error?.requiresNewLogin ? (
          <Link href="/login" onClick={abandon} className={buttonVariants({ size: 'lg' })}>
            Log in again
          </Link>
        ) : (
          <Button type="submit" size="lg" disabled={code.length !== 6 || verify.isPending}>
            {verify.isPending ? 'Verifying…' : 'Verify and continue'}
          </Button>
        )}
        <div className="flex flex-col items-center gap-1 text-sm">
          <Button
            variant="ghost"
            size="sm"
            disabled={resendIn > 0 || resend.isPending}
            onClick={() => resend.mutate(challenge.id)}
          >
            {resendIn > 0 ? `Resend code in ${resendIn} s` : 'Resend code'}
          </Button>
          {resendError && (
            <p role="alert" className="text-danger">
              {resendError.message}
            </p>
          )}
        </div>
      </form>
    </AuthLayout>
  );
}
