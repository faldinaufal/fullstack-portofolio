// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { z } from 'zod';

// Field rules (FSD 6.12).
export const BranchNameSchema = z.string().trim().min(2).max(100);
export const PhoneSchema = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{6,14}$/, 'Use the international format, e.g. +15550147123.');
export const AddressSchema = z.string().trim().min(3).max(300);

/** Wall-clock time `HH:MM` in the platform time zone, in 15-minute steps. */
export const WallTimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):(00|15|30|45)$/, 'Use HH:MM in 15-minute steps.');

/** Calendar date `YYYY-MM-DD`. */
export const DateOnlySchema = z.iso.date();

export const OpeningHoursSchema = z
  .object({
    /** 0 = Sunday … 6 = Saturday. A weekday without an entry is closed. */
    weekday: z.number().int().min(0).max(6),
    opensAt: WallTimeSchema,
    closesAt: WallTimeSchema,
  })
  .refine((hours) => hours.opensAt < hours.closesAt, {
    message: 'Closing time must be after opening time.',
    path: ['closesAt'],
  })
  .meta({ id: 'OpeningHours' });
export type OpeningHours = z.infer<typeof OpeningHoursSchema>;

export const ClosureSchema = z
  .object({
    id: z.uuid(),
    startsOn: DateOnlySchema,
    endsOn: DateOnlySchema,
    reason: z.string(),
  })
  .meta({ id: 'BranchClosure' });
export type Closure = z.infer<typeof ClosureSchema>;

export const BranchSummarySchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    address: z.string().nullable(),
    phone: z.string().nullable(),
    archived: z.boolean(),
    /** Optimistic-locking version; send it back in `If-Match` when updating (FSD 5.1). */
    version: z.number().int(),
    activeMembers: z.number().int(),
  })
  .meta({ id: 'BranchSummary' });
export type BranchSummary = z.infer<typeof BranchSummarySchema>;

export const BranchDetailSchema = BranchSummarySchema.extend({
  openingHours: z.array(OpeningHoursSchema),
  /** Closures that end today or later. */
  closures: z.array(ClosureSchema),
}).meta({ id: 'BranchDetail' });
export type BranchDetail = z.infer<typeof BranchDetailSchema>;

export const BranchListSchema = z
  .object({ items: z.array(BranchSummarySchema) })
  .meta({ id: 'BranchList' });
export type BranchList = z.infer<typeof BranchListSchema>;

export const CreateBranchRequestSchema = z
  .object({
    name: BranchNameSchema,
    address: AddressSchema.nullable().optional(),
    phone: PhoneSchema.nullable().optional(),
  })
  .meta({ id: 'CreateBranchRequest' });
export type CreateBranchRequest = z.infer<typeof CreateBranchRequestSchema>;

export const UpdateBranchRequestSchema = z
  .object({
    name: BranchNameSchema.optional(),
    address: AddressSchema.nullable().optional(),
    phone: PhoneSchema.nullable().optional(),
  })
  .meta({ id: 'UpdateBranchRequest' });
export type UpdateBranchRequest = z.infer<typeof UpdateBranchRequestSchema>;

export const ReplaceOpeningHoursRequestSchema = z
  .object({ hours: z.array(OpeningHoursSchema).max(7) })
  .refine((body) => new Set(body.hours.map((h) => h.weekday)).size === body.hours.length, {
    message: 'Each weekday can appear once.',
    path: ['hours'],
  })
  .meta({ id: 'ReplaceOpeningHoursRequest' });
export type ReplaceOpeningHoursRequest = z.infer<typeof ReplaceOpeningHoursRequestSchema>;

export const CreateClosureRequestSchema = z
  .object({
    startsOn: DateOnlySchema,
    endsOn: DateOnlySchema,
    reason: z.string().trim().min(2).max(200),
  })
  .refine((body) => body.startsOn <= body.endsOn, {
    message: 'The end date must not be before the start date.',
    path: ['endsOn'],
  })
  .meta({ id: 'CreateClosureRequest' });
export type CreateClosureRequest = z.infer<typeof CreateClosureRequestSchema>;
