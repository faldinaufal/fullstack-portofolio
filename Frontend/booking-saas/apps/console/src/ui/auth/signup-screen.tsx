// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import { Button, DemoSignupHint, TextField } from '@tempora/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type SubmitEvent } from 'react';
import { toErrorView } from '@/core/auth/presentation/auth-messages';
import {
  PASSWORD_MIN_LENGTH,
  suggestSlug,
  validateSignup,
  type FieldErrors,
} from '@/core/auth/presentation/password-forms';
import { useSignup } from '@/core/auth/presentation/use-auth';
import { DEMO_EMAIL_DOMAIN, DEMO_INBOX_URL, DEMO_MODE } from '@/core/shared/presentation/demo';
import { AuthLayout } from './auth-layout';
import { FormError } from './form-error';
import { formText } from '@/ui/common/form-values';

/** FSD 3.4 step 1: create the team account and the business, then confirm the email code. */
export function SignupScreen() {
  const router = useRouter();
  const signup = useSignup();
  const [businessName, setBusinessName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [localErrors, setLocalErrors] = useState<FieldErrors>({});
  const apiError = toErrorView(signup.error);
  const fieldError = (field: string) => localErrors[field] ?? apiError?.fields[field];

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const values = {
      name: formText(form, 'name'),
      email: formText(form, 'email'),
      password: formText(form, 'password'),
      businessName,
      slug,
    };
    const errors = validateSignup(values);
    setLocalErrors(errors);
    if (Object.keys(errors).length > 0) return;
    signup.mutate(values, { onSuccess: () => router.push('/login/verify') });
  }

  return (
    <AuthLayout
      title="Create your business account"
      description="You become the owner. Add branches, services and your team next."
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
        {DEMO_MODE && <DemoSignupHint domain={DEMO_EMAIL_DOMAIN} inboxUrl={DEMO_INBOX_URL} />}
        <FormError error={apiError} />
        <TextField
          label="Your name"
          name="name"
          autoComplete="name"
          required
          error={fieldError('name')}
        />
        <TextField
          label="Work email"
          name="email"
          type="email"
          autoComplete="email"
          {...(DEMO_MODE && { placeholder: `yourname@${DEMO_EMAIL_DOMAIN}` })}
          required
          error={fieldError('email')}
        />
        <TextField
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          hint={`At least ${PASSWORD_MIN_LENGTH} characters. A short sentence works well.`}
          error={fieldError('password')}
        />
        <TextField
          label="Business name"
          name="businessName"
          autoComplete="organization"
          required
          value={businessName}
          onChange={(event) => {
            setBusinessName(event.target.value);
            if (!slugEdited) setSlug(suggestSlug(event.target.value));
          }}
          error={fieldError('businessName')}
        />
        <TextField
          label="Booking page address"
          name="slug"
          required
          value={slug}
          onChange={(event) => {
            setSlugEdited(true);
            setSlug(event.target.value.toLowerCase());
          }}
          hint={
            <>
              Customers book at{' '}
              <span className="font-semibold text-foreground">/{slug || 'your-business'}</span>
            </>
          }
          error={fieldError('slug')}
        />
        <Button type="submit" size="lg" disabled={signup.isPending} className="mt-2">
          {signup.isPending ? 'Creating…' : 'Create account'}
        </Button>
      </form>
    </AuthLayout>
  );
}
