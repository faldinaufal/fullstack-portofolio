// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { z } from 'zod';
import { ExportFormatSchema } from './console-bookings.js';
import { DateOnlySchema } from './console-branches.js';

/** The Console's audit log and email log (FSD 2.2, 5.4). */

export const AuditLogQuerySchema = z.object({
  /** Who did it: name contains. */
  actor: z.string().trim().min(1).max(100).optional(),
  /** An action (`booking.cancelled`) or a group of them (`booking.`). */
  action: z
    .string()
    .trim()
    .regex(/^[a-z_]+(\.[a-z_]*)?$/)
    .max(80)
    .optional(),
  entityType: z
    .string()
    .regex(/^[a-z_]+$/)
    .max(40)
    .optional(),
  entityId: z.uuid().optional(),
  /** Calendar dates in the platform time zone, both included. */
  from: DateOnlySchema.optional(),
  to: DateOnlySchema.optional(),
  /** From the previous page's `nextCursor`; the audit log pages by cursor (FSD 5.1). */
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  format: ExportFormatSchema,
});
export type AuditLogQuery = z.infer<typeof AuditLogQuerySchema>;

export const AuditLogEntrySchema = z
  .object({
    id: z.uuid(),
    at: z.iso.datetime(),
    actor: z.object({
      type: z.enum(['team_member', 'platform_admin', 'customer', 'system']),
      label: z.string(),
    }),
    action: z.string(),
    entityType: z.string(),
    entityId: z.string().nullable(),
    branch: z.object({ id: z.uuid(), name: z.string() }).nullable(),
    before: z.unknown(),
    after: z.unknown(),
    reason: z.string().nullable(),
  })
  .meta({ id: 'AuditLogEntry' });
export type AuditLogEntry = z.infer<typeof AuditLogEntrySchema>;

export const AuditLogPageSchema = z
  .object({
    items: z.array(AuditLogEntrySchema),
    /** Null on the last page. */
    nextCursor: z.string().nullable(),
    timeZone: z.string(),
  })
  .meta({ id: 'AuditLogPage' });
export type AuditLogPage = z.infer<typeof AuditLogPageSchema>;

export const EmailStatusSchema = z.enum(['queued', 'sent', 'failed', 'skipped']);
export type EmailStatus = z.infer<typeof EmailStatusSchema>;

export const EmailLogQuerySchema = z.object({
  status: EmailStatusSchema.optional(),
  /** Recipient address contains. */
  q: z.string().trim().min(1).max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export type EmailLogQuery = z.infer<typeof EmailLogQuerySchema>;

/** One email of the outbox. The content (`payload`) is never shown: it can hold links. */
export const EmailLogEntrySchema = z
  .object({
    id: z.uuid(),
    to: z.string(),
    template: z.string(),
    status: EmailStatusSchema,
    attempts: z.number().int(),
    lastError: z.string().nullable(),
    createdAt: z.iso.datetime(),
    sentAt: z.iso.datetime().nullable(),
    /** Queued: when the next try (or the scheduled send) happens. */
    nextAttemptAt: z.iso.datetime().nullable(),
    bookingId: z.uuid().nullable(),
  })
  .meta({ id: 'EmailLogEntry' });
export type EmailLogEntry = z.infer<typeof EmailLogEntrySchema>;

export const EmailLogPageSchema = z
  .object({
    items: z.array(EmailLogEntrySchema),
    page: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int(),
    timeZone: z.string(),
  })
  .meta({ id: 'EmailLogPage' });
export type EmailLogPage = z.infer<typeof EmailLogPageSchema>;
