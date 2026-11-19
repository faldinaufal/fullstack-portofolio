// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { z } from 'zod';
import { PhoneSchema } from './console-branches.js';
import { EmailSchema, PasswordSchema, PersonNameSchema } from './console-auth.js';

/** `/v1/portal/auth/*` and `/v1/portal/me` (FSD 5.3). Customers have no 2FA (FSD 6.11). */

export const CustomerSignupRequestSchema = z
  .object({
    name: PersonNameSchema,
    email: EmailSchema,
    password: PasswordSchema,
    phone: PhoneSchema.optional(),
  })
  .meta({ id: 'CustomerSignupRequest' });
export type CustomerSignupRequest = z.infer<typeof CustomerSignupRequestSchema>;

export const CustomerLoginRequestSchema = z
  .object({ email: EmailSchema, password: z.string().min(1).max(200) })
  .meta({ id: 'CustomerLoginRequest' });
export type CustomerLoginRequest = z.infer<typeof CustomerLoginRequestSchema>;

export const VerifyEmailRequestSchema = z
  .object({ token: z.string().min(20).max(200) })
  .meta({ id: 'VerifyEmailRequest' });
export type VerifyEmailRequest = z.infer<typeof VerifyEmailRequestSchema>;

export const CustomerProfileSchema = z
  .object({
    id: z.uuid(),
    email: z.string(),
    name: z.string(),
    phone: z.string().nullable(),
    emailVerified: z.boolean(),
  })
  .meta({ id: 'CustomerProfile' });
export type CustomerProfile = z.infer<typeof CustomerProfileSchema>;

export const UpdateCustomerProfileRequestSchema = z
  .object({
    name: PersonNameSchema.optional(),
    phone: PhoneSchema.nullable().optional(),
  })
  .meta({ id: 'UpdateCustomerProfileRequest' });
export type UpdateCustomerProfileRequest = z.infer<typeof UpdateCustomerProfileRequestSchema>;

export const ChangePasswordRequestSchema = z
  .object({
    currentPassword: z.string().min(1).max(200),
    newPassword: PasswordSchema,
  })
  .meta({ id: 'ChangePasswordRequest' });
export type ChangePasswordRequest = z.infer<typeof ChangePasswordRequestSchema>;

export const SessionInfoSchema = z
  .object({
    id: z.uuid(),
    /** "Chrome on Windows" */
    device: z.string(),
    createdAt: z.iso.datetime(),
    lastSeenAt: z.iso.datetime(),
    current: z.boolean(),
  })
  .meta({ id: 'SessionInfo' });
export type SessionInfo = z.infer<typeof SessionInfoSchema>;

export const SessionListSchema = z
  .object({ items: z.array(SessionInfoSchema) })
  .meta({ id: 'SessionList' });
export type SessionList = z.infer<typeof SessionListSchema>;
