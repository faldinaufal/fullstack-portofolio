// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { z } from 'zod';
import { EmailSchema, PersonNameSchema } from './console-auth.js';
import { DateOnlySchema, PhoneSchema } from './console-branches.js';

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
    /** The therapist's photo (FSD 6.15); null shows the initials. */
    therapistPhotoUrl: z.url().nullable(),
    startsAt: z.iso.datetime(),
    endsAt: z.iso.datetime(),
    priceCents: z.number().int(),
    /** Platform time zone: show times in it, not in the visitor's (FSD 4.1). */
    timeZone: z.string(),
    /** Until when the slot is held for payment (pending bookings only). */
    holdExpiresAt: z.iso.datetime().nullable(),
    invoiceNumber: z.string(),
    /** Allowed actions, decided by the API so every screen shows the same buttons. */
    actions: z.object({ pay: z.boolean(), cancel: z.boolean(), reschedule: z.boolean() }),
  })
  .meta({ id: 'PortalBooking' });
export type PortalBooking = z.infer<typeof PortalBookingSchema>;

export const BookingCreatedSchema = z
  .object({
    booking: PortalBookingSchema,
    /** Payment page (Stripe Checkout, or the demo checkout without Stripe keys). */
    checkoutUrl: z.url(),
    /**
     * Access to this booking without a login (`Authorization: Guest <token>`), for the
     * payment and confirmation pages. Shown once; keep it out of URLs (FSD 5.3).
     */
    accessToken: z.string(),
  })
  .meta({ id: 'BookingCreated' });
export type BookingCreated = z.infer<typeof BookingCreatedSchema>;

/** Demo provider only: what the demo checkout page reports. */
export const DemoCheckoutOutcomeSchema = z
  .object({ outcome: z.enum(['paid', 'expired']) })
  .meta({ id: 'DemoCheckoutOutcome' });
export type DemoCheckoutOutcome = z.infer<typeof DemoCheckoutOutcomeSchema>;

export const BookingInvoiceSchema = z
  .object({
    number: z.string(),
    status: z.enum(['open', 'paid', 'void']),
    amountCents: z.number().int(),
    issuedAt: z.iso.datetime(),
    paidAt: z.iso.datetime().nullable(),
  })
  .meta({ id: 'BookingInvoice' });

/** `GET /v1/portal/bookings/:id` and `/guest/booking`: the booking with what may be done next. */
export const PortalBookingDetailSchema = PortalBookingSchema.extend({
  branchId: z.uuid(),
  serviceId: z.uuid(),
  staffId: z.uuid(),
  branchAddress: z.string().nullable(),
  notes: z.string().nullable(),
  invoice: BookingInvoiceSchema,
  /** Pay before this (the Checkout expiry, FSD 6.3); null when nothing is left to pay. */
  payBy: z.iso.datetime().nullable(),
  /**
   * Confirmed bookings only (FSD 6.5): customer reschedules left and the cut-off, so the
   * Portal can say why rescheduling is not offered.
   */
  rescheduling: z.object({ remaining: z.number().int(), until: z.iso.datetime() }).nullable(),
}).meta({ id: 'PortalBookingDetail' });
export type PortalBookingDetail = z.infer<typeof PortalBookingDetailSchema>;

export const PortalBookingListQuerySchema = z.object({
  when: z.enum(['upcoming', 'past']).default('upcoming'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type PortalBookingListQuery = z.infer<typeof PortalBookingListQuerySchema>;

export const PortalBookingListSchema = z
  .object({
    items: z.array(PortalBookingSchema),
    page: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int(),
    /** Size of both tabs, for "Upcoming (2) · Past (5)". */
    counts: z.object({ upcoming: z.number().int(), past: z.number().int() }),
  })
  .meta({ id: 'PortalBookingList' });
export type PortalBookingList = z.infer<typeof PortalBookingListSchema>;

export const CheckoutLinkSchema = z.object({ checkoutUrl: z.url() }).meta({ id: 'CheckoutLink' });
export type CheckoutLink = z.infer<typeof CheckoutLinkSchema>;

/** `GET /v1/portal/bookings/:id/reschedule-slots` (FSD 6.5). */
export const RescheduleSlotsQuerySchema = z.object({
  date: DateOnlySchema,
  /** Another therapist of the same branch who performs the service, or the current one. */
  staffId: z.uuid(),
});
export type RescheduleSlotsQuery = z.infer<typeof RescheduleSlotsQuerySchema>;

export const RescheduleRequestSchema = z
  .object({
    startsAt: z.iso.datetime({ offset: true }),
    /** Defaults to the current therapist. */
    staffId: z.uuid().optional(),
  })
  .meta({ id: 'RescheduleRequest' });
export type RescheduleRequest = z.infer<typeof RescheduleRequestSchema>;

export const PortalInvoiceSummarySchema = z
  .object({
    bookingId: z.uuid(),
    number: z.string(),
    status: z.enum(['open', 'paid', 'void']),
    amountCents: z.number().int(),
    issuedAt: z.iso.datetime(),
    paidAt: z.iso.datetime().nullable(),
    businessName: z.string(),
    serviceName: z.string(),
  })
  .meta({ id: 'PortalInvoiceSummary' });
export type PortalInvoiceSummary = z.infer<typeof PortalInvoiceSummarySchema>;

export const InvoiceStatusSchema = z.enum(['open', 'paid', 'void']);
export type InvoiceStatus = z.infer<typeof InvoiceStatusSchema>;

export const PortalInvoiceListQuerySchema = z.object({
  status: InvoiceStatusSchema.optional(),
  /** Invoice number, business or service name. */
  q: z.string().trim().min(1).max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type PortalInvoiceListQuery = z.infer<typeof PortalInvoiceListQuerySchema>;

export const PortalInvoiceListSchema = z
  .object({
    items: z.array(PortalInvoiceSummarySchema),
    page: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int(),
  })
  .meta({ id: 'PortalInvoiceList' });
export type PortalInvoiceList = z.infer<typeof PortalInvoiceListSchema>;

/** `GET /v1/portal/invoices/summary`: totals for the Invoices page (FSD 5.3). */
export const PortalInvoiceTotalsSchema = z
  .object({
    /** Calendar year in the platform time zone, e.g. 2026. */
    year: z.number().int(),
    paid: z.object({ count: z.number().int(), amountCents: z.number().int() }),
    open: z.object({ count: z.number().int(), amountCents: z.number().int() }),
  })
  .meta({ id: 'PortalInvoiceTotals' });
export type PortalInvoiceTotals = z.infer<typeof PortalInvoiceTotalsSchema>;

/** `GET /v1/portal/bookings/:id/invoice` (FSD 6.10): everything a printed invoice shows. */
export const PortalInvoiceSchema = z
  .object({
    bookingId: z.uuid(),
    number: z.string(),
    status: z.enum(['open', 'paid', 'void']),
    currency: z.string(),
    amountCents: z.number().int(),
    issuedAt: z.iso.datetime(),
    paidAt: z.iso.datetime().nullable(),
    voidedAt: z.iso.datetime().nullable(),
    voidReason: z.string().nullable(),
    business: z.object({ name: z.string(), slug: z.string() }),
    branch: z.object({ name: z.string(), address: z.string().nullable() }),
    billedTo: z.object({ name: z.string(), email: z.string() }),
    line: z.object({
      description: z.string(),
      therapist: z.string(),
      startsAt: z.iso.datetime(),
      durationMinutes: z.number().int(),
    }),
    timeZone: z.string(),
  })
  .meta({ id: 'PortalInvoice' });
export type PortalInvoice = z.infer<typeof PortalInvoiceSchema>;
