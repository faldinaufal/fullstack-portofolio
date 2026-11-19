// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { z } from 'zod';
import { DateOnlySchema } from './console-branches.js';
import { BookingStatusSchema } from './portal-bookings.js';

/** Booking operations in the Console (FSD 2.2, 3.7, 3.8, 5.4, 6.5–6.7). */

export const ConsoleBookingListQuerySchema = z.object({
  status: BookingStatusSchema.optional(),
  branchId: z.uuid().optional(),
  staffId: z.uuid().optional(),
  serviceId: z.uuid().optional(),
  /** Calendar dates in the platform time zone, both included. */
  from: DateOnlySchema.optional(),
  to: DateOnlySchema.optional(),
  /** Customer name or email contains. */
  q: z.string().trim().min(1).max(100).optional(),
  sort: z.enum(['startsAt', '-startsAt']).default('startsAt'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export type ConsoleBookingListQuery = z.infer<typeof ConsoleBookingListQuerySchema>;

export const ConsoleBookingSchema = z
  .object({
    id: z.uuid(),
    status: BookingStatusSchema,
    startsAt: z.iso.datetime(),
    endsAt: z.iso.datetime(),
    serviceName: z.string(),
    priceCents: z.number().int(),
    branch: z.object({ id: z.uuid(), name: z.string() }),
    therapist: z.object({ id: z.uuid(), name: z.string() }),
    /** Email is left out for staff (FSD 1.2: name and notes only). */
    customer: z.object({ name: z.string(), email: z.string().nullable() }),
    invoice: z.object({ number: z.string(), status: z.enum(['open', 'paid', 'void']) }),
  })
  .meta({ id: 'ConsoleBooking' });
export type ConsoleBooking = z.infer<typeof ConsoleBookingSchema>;

export const ConsoleBookingListSchema = z
  .object({
    items: z.array(ConsoleBookingSchema),
    page: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int(),
    /** Show times in the platform time zone. */
    timeZone: z.string(),
  })
  .meta({ id: 'ConsoleBookingList' });
export type ConsoleBookingList = z.infer<typeof ConsoleBookingListSchema>;

export const TimelineEntrySchema = z.object({
  at: z.iso.datetime(),
  actor: z.string(),
  action: z.string(),
  reason: z.string().nullable(),
  before: z.unknown(),
  after: z.unknown(),
});
export type TimelineEntry = z.infer<typeof TimelineEntrySchema>;

export const ConsoleBookingDetailSchema = ConsoleBookingSchema.extend({
  customer: z.object({
    id: z.uuid(),
    name: z.string(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
  }),
  notes: z.string().nullable(),
  durationMinutes: z.number().int(),
  bufferMinutes: z.number().int(),
  serviceId: z.uuid(),
  holdExpiresAt: z.iso.datetime().nullable(),
  cancelReason: z.string().nullable(),
  refundHandledExternally: z.boolean(),
  markedAt: z.iso.datetime().nullable(),
  customerRescheduleCount: z.number().int(),
  timeZone: z.string(),
  /** Decided by the API for the caller's role (FSD 1.2, 6.7). */
  actions: z.object({
    reschedule: z.boolean(),
    reassign: z.boolean(),
    cancel: z.boolean(),
    /** Paid bookings: a reason is required and the refund happens outside Tempora. */
    cancelNeedsReason: z.boolean(),
    complete: z.boolean(),
    noShow: z.boolean(),
  }),
  /** From the audit log, oldest first. Empty for staff. */
  timeline: z.array(TimelineEntrySchema),
}).meta({ id: 'ConsoleBookingDetail' });
export type ConsoleBookingDetail = z.infer<typeof ConsoleBookingDetailSchema>;

export const TeamRescheduleRequestSchema = z
  .object({ startsAt: z.iso.datetime({ offset: true }), staffId: z.uuid().optional() })
  .meta({ id: 'TeamRescheduleRequest' });
export type TeamRescheduleRequest = z.infer<typeof TeamRescheduleRequestSchema>;

export const ReassignRequestSchema = z
  .object({ staffId: z.uuid() })
  .meta({ id: 'ReassignRequest' });
export type ReassignRequest = z.infer<typeof ReassignRequestSchema>;

export const TeamCancelRequestSchema = z
  .object({ reason: z.string().trim().min(3).max(500).optional() })
  .meta({ id: 'TeamCancelRequest' });
export type TeamCancelRequest = z.infer<typeof TeamCancelRequestSchema>;

export const CalendarQuerySchema = z.object({
  from: DateOnlySchema,
  to: DateOnlySchema,
  /** Owner chooses; managers and staff always see their own branch. */
  branchId: z.uuid().optional(),
});
export type CalendarQuery = z.infer<typeof CalendarQuerySchema>;

export const CalendarSchema = z
  .object({
    timeZone: z.string(),
    branch: z.object({ id: z.uuid(), name: z.string() }),
    /** Columns: staff see only themselves. */
    therapists: z.array(z.object({ id: z.uuid(), name: z.string() })),
    bookings: z.array(
      z.object({
        id: z.uuid(),
        status: BookingStatusSchema,
        startsAt: z.iso.datetime(),
        endsAt: z.iso.datetime(),
        blockedUntil: z.iso.datetime(),
        staffId: z.uuid(),
        serviceName: z.string(),
        customerName: z.string(),
        notes: z.string().nullable(),
      }),
    ),
    timeOff: z.array(
      z.object({
        id: z.uuid(),
        staffId: z.uuid(),
        startsAt: z.iso.datetime(),
        endsAt: z.iso.datetime(),
        reason: z.string().nullable(),
      }),
    ),
  })
  .meta({ id: 'Calendar' });
export type Calendar = z.infer<typeof CalendarSchema>;

/** Free times for the team's reschedule dialog: same rules, own time not counted as taken. */
export const TeamSlotsQuerySchema = z.object({ date: DateOnlySchema, staffId: z.uuid() });
export type TeamSlotsQuery = z.infer<typeof TeamSlotsQuerySchema>;
