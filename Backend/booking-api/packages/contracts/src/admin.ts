// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { z } from 'zod';
import { EmailSchema, OtpCodeSchema, PersonNameSchema, SlugSchema } from './console-auth.js';
import { DateOnlySchema } from './console-branches.js';

/** Platform Admin (`/v1/admin`, FSD 2.3, 5.5). */

export const AdminLoginRequestSchema = z
  .object({ email: EmailSchema, password: z.string().min(1).max(200) })
  .meta({ id: 'AdminLoginRequest' });
export type AdminLoginRequest = z.infer<typeof AdminLoginRequestSchema>;

/** Login and step-up: the emailed code for a challenge. */
export const AdminCodeRequestSchema = z
  .object({ challengeId: z.uuid(), code: OtpCodeSchema })
  .meta({ id: 'AdminCodeRequest' });
export type AdminCodeRequest = z.infer<typeof AdminCodeRequestSchema>;

export const AdminMeSchema = z
  .object({
    id: z.uuid(),
    email: z.string(),
    name: z.string(),
    /** Sensitive actions work without a new code until then (FSD 6.11); null = ask first. */
    stepUpValidUntil: z.iso.datetime().nullable(),
  })
  .meta({ id: 'AdminMe' });
export type AdminMe = z.infer<typeof AdminMeSchema>;

export const TenantStatusSchema = z.enum(['active', 'suspended']);

export const AdminTenantListQuerySchema = z.object({
  /** Business name or slug contains. */
  q: z.string().trim().min(1).max(100).optional(),
  status: z.enum(['active', 'suspended', 'onboarding']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export type AdminTenantListQuery = z.infer<typeof AdminTenantListQuerySchema>;

export const AdminTenantSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    slug: z.string(),
    status: TenantStatusSchema,
    /** Active but cannot take bookings yet (FSD 3.4); derived, never stored. */
    onboarding: z.boolean(),
    createdAt: z.iso.datetime(),
    members: z.number().int(),
    /** Bookings that take place, last 30 days. */
    recentBookings: z.number().int(),
  })
  .meta({ id: 'AdminTenant' });
export type AdminTenant = z.infer<typeof AdminTenantSchema>;

export const AdminTenantListSchema = z
  .object({
    items: z.array(AdminTenantSchema),
    page: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int(),
  })
  .meta({ id: 'AdminTenantList' });
export type AdminTenantList = z.infer<typeof AdminTenantListSchema>;

export const AdminTenantDetailSchema = AdminTenantSchema.extend({
  invoicePrefix: z.string(),
  suspendedAt: z.iso.datetime().nullable(),
  suspensionReason: z.string().nullable(),
  owner: z.object({ name: z.string(), email: z.string() }).nullable(),
  /** The assisted-onboarding invitation, while nobody owns the business yet. */
  ownerInvitation: z
    .object({
      email: z.string(),
      status: z.enum(['pending', 'expired']),
      expiresAt: z.iso.datetime(),
    })
    .nullable(),
}).meta({ id: 'AdminTenantDetail' });
export type AdminTenantDetail = z.infer<typeof AdminTenantDetailSchema>;

/** FSD 3.5 assisted onboarding: the business, and who is invited to own it. */
export const CreateTenantRequestSchema = z
  .object({
    businessName: PersonNameSchema,
    slug: SlugSchema,
    ownerEmail: EmailSchema,
  })
  .meta({ id: 'CreateTenantRequest' });
export type CreateTenantRequest = z.infer<typeof CreateTenantRequestSchema>;

export const SuspendTenantRequestSchema = z
  .object({ reason: z.string().trim().min(3).max(500) })
  .meta({ id: 'SuspendTenantRequest' });
export type SuspendTenantRequest = z.infer<typeof SuspendTenantRequestSchema>;

export const AdminOverviewSchema = z
  .object({
    timeZone: z.string(),
    tenants: z.object({
      active: z.number().int(),
      onboarding: z.number().int(),
      suspended: z.number().int(),
    }),
    /** The last 14 days, oldest first, empty days included. */
    days: z.array(
      z.object({
        date: DateOnlySchema,
        bookings: z.number().int(),
        payments: z.number().int(),
        revenueCents: z.number().int(),
      }),
    ),
    health: z.object({
      paymentsNeedingAttention: z.number().int(),
      emailsQueued: z.number().int(),
      /** Failed for good in the last 24 hours. */
      emailsFailed: z.number().int(),
    }),
  })
  .meta({ id: 'AdminOverview' });
export type AdminOverview = z.infer<typeof AdminOverviewSchema>;

export const PlatformAuditQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});
export type PlatformAuditQuery = z.infer<typeof PlatformAuditQuerySchema>;

export const PlatformAuditListSchema = z
  .object({
    items: z.array(
      z.object({
        id: z.uuid(),
        at: z.iso.datetime(),
        actor: z.string(),
        action: z.string(),
        entityType: z.string(),
        entityId: z.string().nullable(),
        reason: z.string().nullable(),
        after: z.unknown(),
      }),
    ),
    page: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int(),
  })
  .meta({ id: 'PlatformAuditList' });
export type PlatformAuditList = z.infer<typeof PlatformAuditListSchema>;
