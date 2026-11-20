// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { z } from 'zod';
import { ConsoleBookingListQuerySchema } from './console-bookings.js';
import { CustomerListQuerySchema, InvoiceListQuerySchema } from './console-records.js';

/** Support access (FSD 1.4, 3.10): the owner's grants, and the Platform Admin's support views. */

/** FSD 6.11: a grant lasts 1, 24 or 72 hours. */
export const SupportDurationSchema = z.union([z.literal(1), z.literal(24), z.literal(72)]);

export const SupportGrantSchema = z
  .object({
    id: z.uuid(),
    status: z.enum(['active', 'expired', 'revoked']),
    startsAt: z.iso.datetime(),
    expiresAt: z.iso.datetime(),
    revokedAt: z.iso.datetime().nullable(),
    grantedBy: z.string(),
  })
  .meta({ id: 'SupportGrant' });
export type SupportGrant = z.infer<typeof SupportGrantSchema>;

export const SupportGrantListSchema = z
  .object({
    /** The active grant, if any (also the first item of `items`). */
    active: SupportGrantSchema.nullable(),
    /** Newest first, at most 20. */
    items: z.array(SupportGrantSchema),
  })
  .meta({ id: 'SupportGrantList' });
export type SupportGrantList = z.infer<typeof SupportGrantListSchema>;

export const CreateSupportGrantRequestSchema = z
  .object({ durationHours: SupportDurationSchema })
  .meta({ id: 'CreateSupportGrantRequest' });
export type CreateSupportGrantRequest = z.infer<typeof CreateSupportGrantRequestSchema>;

/** What the Platform Admin sees of a grant: the period only. */
export const SupportAccessSchema = z
  .object({ startsAt: z.iso.datetime(), expiresAt: z.iso.datetime() })
  .meta({ id: 'SupportAccess' });
export type SupportAccess = z.infer<typeof SupportAccessSchema>;

// Support views use the Console's list filters, without exports (nothing leaves the screen).
export const SupportBookingQuerySchema = ConsoleBookingListQuerySchema.omit({ format: true });
export type SupportBookingQuery = z.infer<typeof SupportBookingQuerySchema>;
export const SupportCustomerQuerySchema = CustomerListQuerySchema.omit({ format: true });
export type SupportCustomerQuery = z.infer<typeof SupportCustomerQuerySchema>;
export const SupportInvoiceQuerySchema = InvoiceListQuerySchema.omit({ format: true });
export type SupportInvoiceQuery = z.infer<typeof SupportInvoiceQuerySchema>;
