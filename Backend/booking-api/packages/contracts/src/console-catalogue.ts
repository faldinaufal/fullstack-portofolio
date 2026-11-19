// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { z } from 'zod';
import { WallTimeSchema } from './console-branches.js';
import { MemberSchema } from './console-team.js';

// ---------------------------------------------------------------------------
// Tenant profile and booking settings (FSD 6.1)
// ---------------------------------------------------------------------------

export const BookingSettingsSchema = z
  .object({
    minLeadHours: z.number().int().min(0).max(72),
    maxAdvanceDays: z.number().int().min(1).max(180),
    cancellationCutoffHours: z.number().int().min(0).max(168),
    maxCustomerReschedules: z.number().int().min(0).max(10),
  })
  .meta({ id: 'BookingSettings' });
export type BookingSettings = z.infer<typeof BookingSettingsSchema>;

/**
 * What is still missing before the business can take bookings (FSD 3.4 step 3): at least
 * one branch, one service and one therapist with working hours and services.
 */
export const SetupStatusSchema = z
  .object({
    hasBranch: z.boolean(),
    hasService: z.boolean(),
    hasBookableTherapist: z.boolean(),
    complete: z.boolean(),
  })
  .meta({ id: 'SetupStatus' });
export type SetupStatus = z.infer<typeof SetupStatusSchema>;

export const TenantSettingsSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    slug: z.string(),
    status: z.enum(['active', 'suspended']),
    version: z.number().int(),
    bookingSettings: BookingSettingsSchema,
    setup: SetupStatusSchema,
  })
  .meta({ id: 'TenantSettings' });
export type TenantSettings = z.infer<typeof TenantSettingsSchema>;

export const UpdateTenantRequestSchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    bookingSettings: BookingSettingsSchema.partial().optional(),
  })
  .meta({ id: 'UpdateTenantRequest' });
export type UpdateTenantRequest = z.infer<typeof UpdateTenantRequestSchema>;

// ---------------------------------------------------------------------------
// Service catalogue (FSD 6.12)
// ---------------------------------------------------------------------------

export const ServiceSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    description: z.string().nullable(),
    durationMinutes: z.number().int(),
    bufferMinutes: z.number().int(),
    priceCents: z.number().int(),
    archived: z.boolean(),
    version: z.number().int(),
    /** Active therapists who perform it. */
    therapists: z.number().int(),
  })
  .meta({ id: 'Service' });
export type Service = z.infer<typeof ServiceSchema>;

export const ServiceListSchema = z
  .object({ items: z.array(ServiceSchema) })
  .meta({ id: 'ServiceList' });
export type ServiceList = z.infer<typeof ServiceListSchema>;

const ServiceFields = {
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(500).nullable(),
  durationMinutes: z
    .number()
    .int()
    .min(15)
    .max(480)
    .refine((value) => value % 15 === 0, 'Use multiples of 15 minutes.'),
  bufferMinutes: z
    .number()
    .int()
    .min(0)
    .max(60)
    .refine((value) => value % 5 === 0, 'Use multiples of 5 minutes.'),
  priceCents: z.number().int().min(0).max(1_000_000),
};

export const CreateServiceRequestSchema = z
  .object({ ...ServiceFields, description: ServiceFields.description.optional() })
  .meta({ id: 'CreateServiceRequest' });
export type CreateServiceRequest = z.infer<typeof CreateServiceRequestSchema>;

export const UpdateServiceRequestSchema = z
  .object(ServiceFields)
  .partial()
  .meta({ id: 'UpdateServiceRequest' });
export type UpdateServiceRequest = z.infer<typeof UpdateServiceRequestSchema>;

// ---------------------------------------------------------------------------
// Therapist schedules
// ---------------------------------------------------------------------------

export const WorkingHoursSchema = z
  .object({
    weekday: z.number().int().min(0).max(6),
    startsAt: WallTimeSchema,
    endsAt: WallTimeSchema,
  })
  .refine((hours) => hours.startsAt < hours.endsAt, {
    message: 'The end must be after the start.',
    path: ['endsAt'],
  })
  .meta({ id: 'WorkingHours' });
export type WorkingHours = z.infer<typeof WorkingHoursSchema>;

export const ReplaceWorkingHoursRequestSchema = z
  .object({ hours: z.array(WorkingHoursSchema).max(7) })
  .refine((body) => new Set(body.hours.map((h) => h.weekday)).size === body.hours.length, {
    message: 'Each weekday can appear once.',
    path: ['hours'],
  })
  .meta({ id: 'ReplaceWorkingHoursRequest' });
export type ReplaceWorkingHoursRequest = z.infer<typeof ReplaceWorkingHoursRequestSchema>;

export const ReplaceMemberServicesRequestSchema = z
  .object({ serviceIds: z.array(z.uuid()).max(200) })
  .meta({ id: 'ReplaceMemberServicesRequest' });
export type ReplaceMemberServicesRequest = z.infer<typeof ReplaceMemberServicesRequestSchema>;

export const TimeOffSchema = z
  .object({
    id: z.uuid(),
    startsAt: z.iso.datetime(),
    endsAt: z.iso.datetime(),
    reason: z.string().nullable(),
  })
  .meta({ id: 'TimeOff' });
export type TimeOff = z.infer<typeof TimeOffSchema>;

export const TimeOffListSchema = z
  .object({ items: z.array(TimeOffSchema) })
  .meta({ id: 'TimeOffList' });
export type TimeOffList = z.infer<typeof TimeOffListSchema>;

export const CreateTimeOffRequestSchema = z
  .object({
    startsAt: z.iso.datetime({ offset: true }),
    endsAt: z.iso.datetime({ offset: true }),
    reason: z.string().trim().max(500).optional(),
  })
  .refine((body) => new Date(body.startsAt) < new Date(body.endsAt), {
    message: 'The end must be after the start.',
    path: ['endsAt'],
  })
  .meta({ id: 'CreateTimeOffRequest' });
export type CreateTimeOffRequest = z.infer<typeof CreateTimeOffRequestSchema>;

/** `GET /members/:id`: the member plus their schedule (FSD 2.2 Team member detail). */
export const MemberDetailSchema = MemberSchema.extend({
  workingHours: z.array(WorkingHoursSchema),
  services: z.array(z.object({ id: z.uuid(), name: z.string() })),
  /** Time off that ends now or later. */
  timeOff: z.array(TimeOffSchema),
}).meta({ id: 'MemberDetail' });
export type MemberDetail = z.infer<typeof MemberDetailSchema>;
