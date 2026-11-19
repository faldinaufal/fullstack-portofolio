// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { z } from 'zod';
import { EmailSchema, PersonNameSchema } from './console-auth.js';
import { PhoneSchema } from './console-branches.js';

/** `POST /v1/portal/bookings` and payments (FSD 5.3, 6.3, 6.4). */

export const GuestContactSchema = z
  .object({
    name: PersonNameSchema,
    email: EmailSchema,
    phone: PhoneSchema.optional(),
  })
  .meta({ id: 'GuestContact' });
export type GuestContact = z.infer<typeof GuestContactSchema>;

export const CreateBookingRequestSchema = z
  .object({
    tenantSlug: z.string().min(1).max(40),
    branchId: z.uuid(),
    serviceId: z.uuid(),
    staffId: z.uuid(),
    /** A start time from the availability endpoint (ISO 8601 with offset). */
    startsAt: z.iso.datetime({ offset: true }),
    notes: z.string().trim().max(500).optional(),
    /** Required when not logged in (guest booking); ignored for a logged-in customer. */
    guest: GuestContactSchema.optional(),
  })
  .meta({ id: 'CreateBookingRequest' });
export type CreateBookingRequest = z.infer<typeof CreateBookingRequestSchema>;

export const BookingStatusSchema = z.enum([
  'pending_payment',
  'confirmed',
  'cancelled',
  'expired',
  'completed',
  'no_show',
]);
export type BookingStatus = z.infer<typeof BookingStatusSchema>;

export const PortalBookingSchema = z
  .object({
    id: z.uuid(),
    status: BookingStatusSchema,
    business: z.object({ slug: z.string(), name: z.string() }),
    branchName: z.string(),
    serviceName: z.string(),
    therapist: z.string(),
    startsAt: z.iso.datetime(),
    endsAt: z.iso.datetime(),
    priceCents: z.number().int(),
    /** Until when the slot is held for payment (pending bookings only). */
    holdExpiresAt: z.iso.datetime().nullable(),
    invoiceNumber: z.string(),
  })
  .meta({ id: 'PortalBooking' });
export type PortalBooking = z.infer<typeof PortalBookingSchema>;

export const BookingCreatedSchema = z
  .object({
    booking: PortalBookingSchema,
    /** Payment page (Stripe Checkout, or the demo checkout without Stripe keys). */
    checkoutUrl: z.url(),
  })
  .meta({ id: 'BookingCreated' });
export type BookingCreated = z.infer<typeof BookingCreatedSchema>;

/** Demo provider only: what the demo checkout page reports. */
export const DemoCheckoutOutcomeSchema = z
  .object({ outcome: z.enum(['paid', 'expired']) })
  .meta({ id: 'DemoCheckoutOutcome' });
export type DemoCheckoutOutcome = z.infer<typeof DemoCheckoutOutcomeSchema>;
