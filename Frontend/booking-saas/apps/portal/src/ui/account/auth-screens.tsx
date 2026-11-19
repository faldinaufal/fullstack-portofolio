// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import { Alert, Button, buttonVariants, TextField } from '@tempora/ui';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, type SubmitEvent } from 'react';
import {
  PASSWORD_MIN_LENGTH,
  signupProblems,
  useCustomer,
  useLogin,
  useRequestPasswordReset,
  useResetPassword,
  useSignup,
  useVerifyEmail,
} from '@/core/account/presentation/use-account';
import { toRequestErrorView } from '@/core/shared/presentation/error-view';
import { formText } from '@/ui/common/form-values';
import { RequestErrorAlert } from '@/ui/common/request-error';
import { AccountCard } from './account-card';

/** Where to go after logging in: a same-site path from `?next=`, never another origin. */
function useNextPath(): string {
  const next = useSearchParams().get('next');
  return next?.startsWith('/') && !next.startsWith('//') ? next : '/account/profile';
}

export function LoginScreen() {
  const router = useRouter();
  const next = useNextPath();
  const customer = useCustomer();
  const login = useLogin();
  const error = toRequestErrorView(login.error, {
    INVALID_CREDENTIALS: 'The email or password is incorrect.',
  });

  useEffect(() => {
    if (customer.data) router.replace(next);
  }, [customer.data, next, router]);

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    login.mutate({ email: formText(form, 'email'), password: formText(form, 'password') });
  }

  return (
    <AccountCard
      title="Log in"
      description="See your bookings and book faster next time."
      footer={
        <>
          New here?{' '}
          <Link href="/signup" className="font-bold text-primary-text">
            Create an account
          </Link>{' '}
          or book as a guest.
        </>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
        <RequestErrorAlert error={error} />
        <TextField label="Email" name="email" type="email" autoComplete="email" required />
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
        <Button type="submit" size="lg" disabled={login.isPending}>
          {login.isPending ? 'Logging in…' : 'Log in'}
        </Button>
      </form>
    </AccountCard>
  );
}

export function SignupScreen() {
  const router = useRouter();
  const signup = useSignup();
  // Back to where sign-up started (e.g. booking step 3), else the profile with a welcome.
  const returning = useSearchParams().has('next');
  const next = useNextPath();
  const [problems, setProblems] = useState<Record<string, string>>({});
  const error = toRequestErrorView(signup.error, {
    EMAIL_TAKEN: 'An account with this email already exists. Log in instead.',
  });
  const field = (name: string) => problems[name] ?? error?.fields[name];

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const phone = formText(form, 'phone').trim();
    const input = {
      name: formText(form, 'name').trim(),
      email: formText(form, 'email').trim(),
      password: formText(form, 'password'),
      ...(phone && { phone }),
    };
    const found = signupProblems(input);
    setProblems(found);
    if (Object.keys(found).length === 0) {
      signup.mutate(input, {
        onSuccess: () => router.push(returning ? next : '/account/profile?welcome=1'),
      });
    }
  }

  return (
    <AccountCard
      title="Create your account"
      description="One account for every business on Tempora."
      footer={
        <>
          Already have an account?{' '}
          <Link href="/login" className="font-bold text-primary-text">
            Log in
          </Link>
        </>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
        <RequestErrorAlert error={error} />
        <TextField label="Your name" name="name" autoComplete="name" error={field('name')} />
        <TextField
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          error={field('email')}
        />
        <TextField
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          hint={`At least ${PASSWORD_MIN_LENGTH} characters. A short sentence works well.`}
          error={field('password')}
        />
        <TextField
          label="Phone (optional)"
          name="phone"
          type="tel"
          autoComplete="tel"
          placeholder="+15550147123"
          hint="For your therapist, if they need to reach you."
          error={field('phone')}
        />
        <Button type="submit" size="lg" disabled={signup.isPending}>
          {signup.isPending ? 'Creating…' : 'Create account'}
        </Button>
      </form>
    </AccountCard>
  );
}

/** Opened from the emailed link `/verify-email?token=…`; confirms once on load. */
export function VerifyEmailScreen() {
  const token = useSearchParams().get('token') ?? '';
  const verify = useVerifyEmail();
  const started = useRef(false);

  useEffect(() => {
    if (started.current || !token) return;
    started.current = true;
    verify.mutate(token);
  }, [token, verify]);

  if (verify.isSuccess) {
    return (
      <AccountCard title="Email confirmed" description="Thanks! Your email address is verified.">
        <Link href="/#businesses" className={buttonVariants({ size: 'lg' })}>
          Find a business
        </Link>
      </AccountCard>
    );
  }
  if (verify.isError || !token) {
    return (
      <AccountCard
        title="Link not valid"
        description="It expired or was already used. Request a new one from your profile."
      >
        <Link href="/account/profile" className={buttonVariants({ size: 'lg' })}>
          Go to my profile
        </Link>
      </AccountCard>
    );
  }
  return (
    <AccountCard title="Confirming your email…">
      <p role="status" className="text-muted">
        One moment.
      </p>
    </AccountCard>
  );
}

export function ForgotPasswordScreen() {
  const request = useRequestPasswordReset();
  const error = toRequestErrorView(request.error);

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    request.mutate(formText(new FormData(event.currentTarget), 'email'));
  }

  return (
    <AccountCard
      title="Reset your password"
      description="We will email you a link to choose a new one."
      footer={
        <Link href="/login" className="font-bold text-primary-text">
          Back to log in
        </Link>
      }
    >
      {request.isSuccess ? (
        <Alert tone="success" title="Check your email">
          If an account exists for that address, a reset link is on its way. It is valid for one
          hour.
        </Alert>
      ) : (
        <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
          <RequestErrorAlert error={error} />
          <TextField label="Email" name="email" type="email" autoComplete="email" required />
          <Button type="submit" size="lg" disabled={request.isPending}>
            {request.isPending ? 'Sending…' : 'Send reset link'}
          </Button>
        </form>
      )}
    </AccountCard>
  );
}

export function ResetPasswordScreen() {
  const token = useSearchParams().get('token') ?? '';
  const reset = useResetPassword();
  const [problem, setProblem] = useState<string | undefined>();
  const error = toRequestErrorView(reset.error, {
    TOKEN_INVALID: 'This link is invalid, was already used or has expired. Request a new one.',
  });

  if (reset.isSuccess) {
    return (
      <AccountCard title="Password changed" description="You were logged out on every device.">
        <Link href="/login" className={buttonVariants({ size: 'lg' })}>
          Log in
        </Link>
      </AccountCard>
    );
  }

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = formText(form, 'password');
    if (password.length < PASSWORD_MIN_LENGTH) {
      setProblem(`Use at least ${PASSWORD_MIN_LENGTH} characters.`);
    } else if (password !== formText(form, 'confirmation')) {
      setProblem('The passwords do not match.');
    } else {
      setProblem(undefined);
      reset.mutate({ token, password });
    }
  }

  return (
    <AccountCard title="Choose a new password">
      {token ? (
        <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
          <RequestErrorAlert error={error} />
          <TextField
            label="New password"
            name="password"
            type="password"
            autoComplete="new-password"
            error={problem ?? error?.fields.password}
          />
          <TextField
            label="Repeat new password"
            name="confirmation"
            type="password"
            autoComplete="new-password"
          />
          <Button type="submit" size="lg" disabled={reset.isPending}>
            {reset.isPending ? 'Saving…' : 'Set new password'}
          </Button>
        </form>
      ) : (
        <Alert tone="danger">This link is incomplete. Open the link from the email again.</Alert>
      )}
    </AccountCard>
  );
}
