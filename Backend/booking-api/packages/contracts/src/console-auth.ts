// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Field rules (FSD 6.11, 6.12). Used by the API to validate requests and by the
// Console to validate forms, so both always agree.
// ---------------------------------------------------------------------------

export const EmailSchema = z.string().trim().toLowerCase().pipe(z.email().max(254));

export const PASSWORD_MIN_LENGTH = 12;
export const PasswordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters.`)
  .max(200);

export const PersonNameSchema = z.string().trim().min(2).max(100);

export const SlugSchema = z
  .string()
  .trim()
  .min(3)
  .max(40)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, digits and single hyphens.');

export const OtpCodeSchema = z.string().regex(/^\d{6}$/, 'Enter the 6-digit code.');

/** The password must not contain the email address or its local part (FSD 6.11). */
export function passwordContainsEmail(password: string, email: string): boolean {
  const lowered = password.toLowerCase();
  const address = email.trim().toLowerCase();
  const localPart = address.split('@')[0] ?? '';
  return lowered.includes(address) || (localPart.length >= 3 && lowered.includes(localPart));
}

// ---------------------------------------------------------------------------
// Requests and responses: /v1/console/auth/*
// ---------------------------------------------------------------------------

/** `GET /auth/csrf`: send the token back in `X-CSRF-Token` on every state-changing request. */
export const CsrfResponseSchema = z.object({ csrfToken: z.string() }).meta({ id: 'CsrfResponse' });
export type CsrfResponse = z.infer<typeof CsrfResponseSchema>;

export const ConsoleSignupRequestSchema = z
  .object({
    name: PersonNameSchema,
    email: EmailSchema,
    password: PasswordSchema,
    businessName: z.string().trim().min(2).max(100),
    slug: SlugSchema,
  })
  .meta({ id: 'ConsoleSignupRequest' });
export type ConsoleSignupRequest = z.infer<typeof ConsoleSignupRequestSchema>;

export const ConsoleLoginRequestSchema = z
  .object({
    email: EmailSchema,
    password: z.string().min(1).max(200),
  })
  .meta({ id: 'ConsoleLoginRequest' });
export type ConsoleLoginRequest = z.infer<typeof ConsoleLoginRequestSchema>;

/** A code was emailed; continue with `POST /auth/verify-otp`. */
export const OtpChallengeSchema = z
  .object({
    status: z.literal('otp_required'),
    challengeId: z.uuid(),
    /** Masked address the code was sent to, e.g. `m***@example.com`. */
    sentTo: z.string(),
    expiresAt: z.iso.datetime(),
    resendAvailableAt: z.iso.datetime(),
  })
  .meta({ id: 'OtpChallenge' });
export type OtpChallenge = z.infer<typeof OtpChallengeSchema>;

/** The session cookie was set (a trusted device skipped the code). */
export const AuthenticatedSchema = z
  .object({ status: z.literal('authenticated') })
  .meta({ id: 'Authenticated' });
export type Authenticated = z.infer<typeof AuthenticatedSchema>;

export const ConsoleLoginResponseSchema = z
  .discriminatedUnion('status', [OtpChallengeSchema, AuthenticatedSchema])
  .meta({ id: 'ConsoleLoginResponse' });
export type ConsoleLoginResponse = z.infer<typeof ConsoleLoginResponseSchema>;

export const VerifyOtpRequestSchema = z
  .object({
    challengeId: z.uuid(),
    code: OtpCodeSchema,
    /** Skip the code on this browser for 30 days (FSD 6.11). */
    trustDevice: z.boolean().default(false),
  })
  .meta({ id: 'VerifyOtpRequest' });
export type VerifyOtpRequest = z.input<typeof VerifyOtpRequestSchema>;

export const ResendOtpRequestSchema = z
  .object({ challengeId: z.uuid() })
  .meta({ id: 'ResendOtpRequest' });
export type ResendOtpRequest = z.infer<typeof ResendOtpRequestSchema>;

export const ForgotPasswordRequestSchema = z
  .object({ email: EmailSchema })
  .meta({ id: 'ForgotPasswordRequest' });
export type ForgotPasswordRequest = z.infer<typeof ForgotPasswordRequestSchema>;

export const ResetPasswordRequestSchema = z
  .object({
    token: z.string().min(20).max(200),
    password: PasswordSchema,
  })
  .meta({ id: 'ResetPasswordRequest' });
export type ResetPasswordRequest = z.infer<typeof ResetPasswordRequestSchema>;

/** Generic acknowledgement that does not reveal whether an account exists. */
export const AcceptedResponseSchema = z
  .object({ status: z.literal('accepted') })
  .meta({ id: 'AcceptedResponse' });
export type AcceptedResponse = z.infer<typeof AcceptedResponseSchema>;

// ---------------------------------------------------------------------------
// GET /v1/console/me
// ---------------------------------------------------------------------------

export const MembershipRoleSchema = z.enum(['owner', 'manager', 'staff']);
export type MembershipRole = z.infer<typeof MembershipRoleSchema>;

export const ConsoleMembershipSchema = z
  .object({
    id: z.uuid(),
    role: MembershipRoleSchema,
    branchId: z.uuid().nullable(),
    tenant: z.object({
      id: z.uuid(),
      slug: z.string(),
      name: z.string(),
      /** Set while a platform admin has suspended the business (FSD 6.9): read-only Console. */
      suspension: z.object({ since: z.iso.datetime(), reason: z.string() }).nullable(),
    }),
  })
  .meta({ id: 'ConsoleMembership' });
export type ConsoleMembership = z.infer<typeof ConsoleMembershipSchema>;

export const ConsoleMeResponseSchema = z
  .object({
    account: z.object({ id: z.uuid(), email: z.string(), name: z.string() }),
    activeMembership: ConsoleMembershipSchema,
    /** Every active membership, for the tenant switcher. */
    memberships: z.array(ConsoleMembershipSchema),
  })
  .meta({ id: 'ConsoleMeResponse' });
export type ConsoleMeResponse = z.infer<typeof ConsoleMeResponseSchema>;
