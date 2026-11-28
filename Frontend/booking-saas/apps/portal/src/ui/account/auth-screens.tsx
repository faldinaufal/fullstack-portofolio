// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import {
  Alert,
  Button,
  buttonVariants,
  DemoAccounts,
  DemoSignupHint,
  fillLoginForm,
  Icon,
  PasswordField,
  TextField,
  type IconName,
} from '@tempora/ui';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, type SubmitEvent } from 'react';
import {
  PASSWORD_MIN_LENGTH,
  passwordStrength,
  signupProblems,
  useCustomer,
  useLogin,
  useRequestPasswordReset,
  useResetPassword,
  useSignup,
  useVerifyEmail,
  type PasswordStrength,
} from '@/core/account/presentation/use-account';
import {
  DEMO_ACCOUNTS,
  DEMO_EMAIL_DOMAIN,
  DEMO_MODE,
  DEMO_PASSWORD,
} from '@/core/shared/presentation/demo';
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
  const formRef = useRef<HTMLFormElement>(null);

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
      title="Welcome back"
      description="Log in to manage your bookings, reschedule sessions and see your invoices."
      footer={
        <>
          Don’t have an account?{' '}
          <Link href="/signup" className="font-semibold text-primary-text">
            Create an account
          </Link>
        </>
      }
    >
      {/* No "remember me": a Portal session lasts 30 days anyway (FSD 6.11). */}
      <form ref={formRef} className="flex flex-col gap-5" onSubmit={submit} noValidate>
        <RequestErrorAlert error={error} />
        <TextField
          label="Email address"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          required
          trailing={<FieldIcon name="emails" />}
        />
        <PasswordField
          label="Password"
          name="password"
          autoComplete="current-password"
          placeholder="••••••••••"
          required
          labelAction={
            <Link href="/forgot-password" className="text-sm font-semibold text-primary-text">
              Forgot password?
            </Link>
          }
        />
        <Button type="submit" size="lg" className="mt-1 w-full" disabled={login.isPending}>
          {login.isPending ? 'Logging in…' : 'Log in'}
          {!login.isPending && <Icon name="arrow-right" size={18} />}
        </Button>
      </form>
      {DEMO_MODE && (
        <DemoAccounts
          className="mt-6"
          accounts={DEMO_ACCOUNTS}
          password={DEMO_PASSWORD}
          inboxUrl="/demo-inbox"
          inboxLead="Booking emails and reset links arrive in the"
          onUse={(account, password) => fillLoginForm(formRef.current, account.email, password)}
        />
      )}
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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
      description="One account for every wellness and physiotherapy business on Tempora."
      footerStyle="inline"
      footer={
        <>
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-primary-text underline">
            Log in
          </Link>
        </>
      }
    >
      <form className="flex flex-col gap-5" onSubmit={submit} noValidate>
        {DEMO_MODE && <DemoSignupHint domain={DEMO_EMAIL_DOMAIN} inboxUrl="/demo-inbox" />}
        <RequestErrorAlert error={error} />
        <TextField
          label="Full name"
          name="name"
          autoComplete="name"
          placeholder="Your name"
          leading={<Icon name="user" size={20} />}
          error={field('name')}
        />
        <TextField
          label="Email address"
          name="email"
          type="email"
          autoComplete="email"
          placeholder={DEMO_MODE ? `yourname@${DEMO_EMAIL_DOMAIN}` : 'you@example.com'}
          leading={<Icon name="emails" size={20} />}
          onChange={(event) => setEmail(event.target.value)}
          error={field('email')}
        />
        <TextField
          label="Mobile phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          placeholder="+15550147123"
          leading={<Icon name="phone" size={20} />}
          labelAction={<span className="text-sm text-muted">Optional</span>}
          hint="Only for the business, if they need to reach you about a booking."
          error={field('phone')}
        />
        <div className="flex flex-col gap-2.5">
          <PasswordField
            label="Create a password"
            name="password"
            autoComplete="new-password"
            leading={<Icon name="lock" size={20} />}
            labelAction={
              <span className="text-sm text-muted">At least {PASSWORD_MIN_LENGTH} characters</span>
            }
            hint="Must not contain your email address. A short sentence works well."
            onChange={(event) => setPassword(event.target.value)}
            error={field('password')}
          />
          <StrengthMeter strength={passwordStrength(password, email)} />
        </div>
        <Button type="submit" size="lg" className="mt-1 w-full" disabled={signup.isPending}>
          {signup.isPending ? 'Creating…' : 'Create account'}
          {!signup.isPending && <Icon name="arrow-right" size={18} />}
        </Button>
      </form>
    </AccountCard>
  );
}

/** Decorative icon at the right edge of a field. */
function FieldIcon({ name }: Readonly<{ name: IconName }>) {
  return (
    <span className="flex size-10 items-center justify-center text-muted">
      <Icon name={name} size={20} />
    </span>
  );
}

const STRENGTH: Record<PasswordStrength, { label: string; bar: string }> = {
  0: { label: '', bar: '' },
  1: { label: 'Too weak', bar: 'bg-danger' },
  2: { label: 'Good', bar: 'bg-warning' },
  3: { label: 'Strong', bar: 'bg-success' },
};

/** Three bars that fill as the password meets the rules; the word says the same in text. */
function StrengthMeter({ strength }: Readonly<{ strength: PasswordStrength }>) {
  const { label, bar } = STRENGTH[strength];
  return (
    <div className="flex items-center gap-3">
      <div aria-hidden="true" className="grid flex-1 grid-cols-3 gap-1.5">
        {[1, 2, 3].map((step) => (
          <span
            key={step}
            className={`h-1 rounded-full transition-colors ${step <= strength ? bar : 'bg-surface-high'}`}
          />
        ))}
      </div>
      <span aria-live="polite" className="min-w-16 text-right text-[13px] font-medium text-muted">
        {label && <span className="sr-only">Password strength: </span>}
        {label}
      </span>
    </div>
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
          <PasswordField
            label="New password"
            name="password"
            autoComplete="new-password"
            hint={`At least ${PASSWORD_MIN_LENGTH} characters.`}
            error={problem ?? error?.fields.password}
          />
          <PasswordField
            label="Repeat new password"
            name="confirmation"
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
