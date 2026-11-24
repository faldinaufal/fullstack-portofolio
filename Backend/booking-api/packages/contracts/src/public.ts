// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { z } from 'zod';
import { ClosureSchema, DateOnlySchema, OpeningHoursSchema } from './console-branches.js';

/** `/v1/public/*`: what anyone can see on the Portal before logging in (FSD 5.2). */

export const DirectoryEntrySchema = z
  .object({
    slug: z.string(),
    name: z.string(),
    branchNames: z.array(z.string()),
    serviceNames: z.array(z.string()),
    logoUrl: z.url().nullable(),
  })
  .meta({ id: 'DirectoryEntry' });
export type DirectoryEntry = z.infer<typeof DirectoryEntrySchema>;

export const DirectorySchema = z
  .object({ items: z.array(DirectoryEntrySchema) })
  .meta({ id: 'Directory' });
export type Directory = z.infer<typeof DirectorySchema>;

export const DirectoryQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
});

export const PublicServiceSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    description: z.string().nullable(),
    durationMinutes: z.number().int(),
    priceCents: z.number().int(),
  })
  .meta({ id: 'PublicService' });
export type PublicService = z.infer<typeof PublicServiceSchema>;

export const PublicBranchSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    address: z.string().nullable(),
    phone: z.string().nullable(),
    openingHours: z.array(OpeningHoursSchema),
    /** Upcoming closures, so customers know before choosing a date. */
    closures: z.array(ClosureSchema.omit({ id: true })),
  })
  .meta({ id: 'PublicBranch' });
export type PublicBranch = z.infer<typeof PublicBranchSchema>;

export const PublicTenantSchema = z
  .object({
    slug: z.string(),
    name: z.string(),
    /** A suspended business shows as temporarily unavailable (FSD 6.9). */
    available: z.boolean(),
    timeZone: z.string(),
    /** How many days ahead customers can book (FSD 6.1), for the date picker. */
    maxAdvanceDays: z.number().int(),
    /** Booking policy shown on the business page (FSD 6.1, 6.5). */
    policy: z.object({
      minLeadHours: z.number().int(),
      cancellationCutoffHours: z.number().int(),
      maxCustomerReschedules: z.number().int(),
    }),
    /** Uploaded by the owner (FSD 6.15); null shows the initials and gradient fallback. */
    logoUrl: z.url().nullable(),
    coverUrl: z.url().nullable(),
    branches: z.array(PublicBranchSchema),
    services: z.array(PublicServiceSchema),
  })
  .meta({ id: 'PublicTenant' });
export type PublicTenant = z.infer<typeof PublicTenantSchema>;

/** A therapist as customers see them: first name and last initial only (FSD 5.2). */
export const PublicTherapistSchema = z
  .object({
    id: z.uuid(),
    displayName: z.string(),
    /** Uploaded in the Console (FSD 6.15); null shows the initials. */
    photoUrl: z.url().nullable(),
    serviceIds: z.array(z.uuid()),
  })
  .meta({ id: 'PublicTherapist' });
export type PublicTherapist = z.infer<typeof PublicTherapistSchema>;

export const PublicBranchDetailSchema = PublicBranchSchema.extend({
  tenant: z.object({ slug: z.string(), name: z.string(), available: z.boolean() }),
  therapists: z.array(PublicTherapistSchema),
  /** Services at least one therapist of this branch performs. */
  services: z.array(PublicServiceSchema),
}).meta({ id: 'PublicBranchDetail' });
export type PublicBranchDetail = z.infer<typeof PublicBranchDetailSchema>;

export const AvailabilityQuerySchema = z.object({
  branchId: z.uuid(),
  serviceId: z.uuid(),
  /** Customers always choose a therapist (no "any therapist", PRD). */
  staffId: z.uuid(),
  date: DateOnlySchema,
});
export type AvailabilityQuery = z.infer<typeof AvailabilityQuerySchema>;

export const AvailabilitySchema = z
  .object({
    date: DateOnlySchema,
    timeZone: z.string(),
    slots: z.array(z.object({ startsAt: z.iso.datetime(), endsAt: z.iso.datetime() })),
  })
  .meta({ id: 'Availability' });
export type Availability = z.infer<typeof AvailabilitySchema>;
