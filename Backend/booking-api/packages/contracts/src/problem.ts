// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { z } from 'zod';

/**
 * Stable error codes returned by the API (FSD 6.13).
 * Apps translate these codes into user-facing messages; never match on `title` or `detail`.
 */
export const ErrorCode = z.enum([
  'VALIDATION_FAILED',
  'UNAUTHENTICATED',
  'INVALID_CREDENTIALS',
  'CODE_INVALID',
  'CODE_EXPIRED',
  'TOKEN_INVALID',
  'CSRF_INVALID',
  'FORBIDDEN',
  'NOT_FOUND',
  'SLOT_TAKEN',
  'OUTSIDE_OPENING_HOURS',
  'BRANCH_CLOSED',
  'OUTSIDE_WORKING_HOURS',
  'THERAPIST_TIME_OFF',
  'TOO_SOON',
  'TOO_FAR_AHEAD',
  'OFF_GRID',
  'SERVICE_NOT_OFFERED',
  'CUTOFF_PASSED',
  'RESCHEDULE_LIMIT_REACHED',
  'HOLD_EXPIRED',
  'HAS_ACTIVE_BOOKINGS',
  'VERSION_CONFLICT',
  'EMAIL_TAKEN',
  'SLUG_TAKEN',
  'ALREADY_MEMBER',
  'INVITATION_PENDING',
  'BRANCH_HAS_MANAGER',
  'HAS_ACTIVE_MEMBERS',
  'OUTSIDE_BRANCH_HOURS',
  'NOT_A_THERAPIST',
  'GUEST_DETAILS_REQUIRED',
  'NOT_CANCELLABLE',
  'NOT_RESCHEDULABLE',
  'NOT_MARKABLE',
  'INVITATION_EXPIRED',
  'IDEMPOTENCY_KEY_REUSED',
  'TENANT_SUSPENDED',
  'RATE_LIMITED',
  'PAYMENT_PROVIDER_UNAVAILABLE',
  'INTERNAL_ERROR',
]);

export type ErrorCode = z.infer<typeof ErrorCode>;

export const FieldErrorSchema = z.object({
  path: z.string(),
  message: z.string(),
});

export type FieldError = z.infer<typeof FieldErrorSchema>;

/** A booking that blocks a change (`HAS_ACTIVE_BOOKINGS`, FSD 6.8). */
export const BookingConflictSchema = z
  .object({
    id: z.string(),
    startsAt: z.iso.datetime(),
    endsAt: z.iso.datetime(),
    serviceName: z.string(),
    therapist: z.string(),
    customerName: z.string(),
  })
  .meta({ id: 'BookingConflict' });
export type BookingConflict = z.infer<typeof BookingConflictSchema>;

/** Error body in the RFC 9457 "problem details" format, plus Tempora's `code` and `requestId`. */
export const ProblemDetailsSchema = z
  .object({
    type: z.string(),
    title: z.string(),
    status: z.number().int(),
    detail: z.string().optional(),
    instance: z.string().optional(),
    code: ErrorCode,
    requestId: z.string(),
    errors: z.array(FieldErrorSchema).optional(),
    /** `HAS_ACTIVE_BOOKINGS`: the bookings to reassign or cancel first. */
    conflicts: z.array(BookingConflictSchema).optional(),
  })
  .meta({ id: 'ProblemDetails' });

export type ProblemDetails = z.infer<typeof ProblemDetailsSchema>;
