// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { z } from 'zod';
import { ConsoleBookingSchema, ExportFormatSchema } from './console-bookings.js';
import { DateOnlySchema } from './console-branches.js';

/** Customers and invoices in the Console (FSD 2.2, 5.4). */

const page = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
};

export const CustomerListQuerySchema = z.object({
  /** Name or email contains. */
  q: z.string().trim().min(1).max(100).optional(),
  sort: z.enum(['name', '-lastVisit']).default('name'),
  ...page,
  format: ExportFormatSchema,
});
export type CustomerListQuery = z.infer<typeof CustomerListQuerySchema>;

export const ConsoleCustomerSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    email: z.string(),
    phone: z.string().nullable(),
    /** Booked with a verified Portal account (not only as a guest). */
    hasAccount: z.boolean(),
    /** Confirmed, completed and no-show bookings (manager: at their branch). */
    bookingCount: z.number().int(),
    lastVisitAt: z.iso.datetime().nullable(),
    nextBookingAt: z.iso.datetime().nullable(),
  })
  .meta({ id: 'ConsoleCustomer' });
export type ConsoleCustomer = z.infer<typeof ConsoleCustomerSchema>;

export const CustomerListSchema = z
  .object({
    items: z.array(ConsoleCustomerSchema),
    page: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int(),
    timeZone: z.string(),
  })
  .meta({ id: 'CustomerList' });
export type CustomerList = z.infer<typeof CustomerListSchema>;

/**
 * Figures for the top of the Customers page, in the same scope as the list (manager: their
 * branch). A "booking" is confirmed, completed or no-show, as in `bookingCount`.
 */
export const CustomerSummarySchema = z
  .object({
    /** Every customer the list shows without a search. */
    total: z.number().int(),
    /** Customers whose first booking was made this calendar month (platform time zone). */
    newThisMonth: z.number().int(),
    /** Customers with two or more bookings. */
    returning: z.number().int(),
    /** Customers with a booking still to come. */
    bookedAhead: z.number().int(),
    /** Confirmed sessions starting in the next 7 days. */
    upcomingSessions: z.number().int(),
    /** Customers with a no-show in the last 90 days. */
    noShows: z.number().int(),
  })
  .meta({ id: 'CustomerSummary' });
export type CustomerSummary = z.infer<typeof CustomerSummarySchema>;

export const ConsoleCustomerDetailSchema = ConsoleCustomerSchema.extend({
  bookings: z.array(ConsoleBookingSchema),
  timeZone: z.string(),
}).meta({ id: 'ConsoleCustomerDetail' });
export type ConsoleCustomerDetail = z.infer<typeof ConsoleCustomerDetailSchema>;

const InvoiceStatusSchema = z.enum(['open', 'paid', 'void']);

export const InvoiceListQuerySchema = z.object({
  status: InvoiceStatusSchema.optional(),
  branchId: z.uuid().optional(),
  /** Issue date in the platform time zone, both included. */
  from: DateOnlySchema.optional(),
  to: DateOnlySchema.optional(),
  /** Invoice number or customer name contains. */
  q: z.string().trim().min(1).max(100).optional(),
  ...page,
  format: ExportFormatSchema,
});
export type InvoiceListQuery = z.infer<typeof InvoiceListQuerySchema>;

export const ConsoleInvoiceSchema = z
  .object({
    id: z.uuid(),
    number: z.string(),
    status: InvoiceStatusSchema,
    amountCents: z.number().int(),
    currency: z.string(),
    issuedAt: z.iso.datetime(),
    paidAt: z.iso.datetime().nullable(),
    voidedAt: z.iso.datetime().nullable(),
    bookingId: z.uuid(),
    serviceName: z.string(),
    branch: z.object({ id: z.uuid(), name: z.string() }),
    customer: z.object({ id: z.uuid(), name: z.string() }),
  })
  .meta({ id: 'ConsoleInvoice' });
export type ConsoleInvoice = z.infer<typeof ConsoleInvoiceSchema>;

export const InvoiceListSchema = z
  .object({
    items: z.array(ConsoleInvoiceSchema),
    page: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int(),
    timeZone: z.string(),
  })
  .meta({ id: 'InvoiceList' });
export type InvoiceList = z.infer<typeof InvoiceListSchema>;

export const ConsoleInvoiceDetailSchema = ConsoleInvoiceSchema.extend({
  voidReason: z.string().nullable(),
  customer: z.object({
    id: z.uuid(),
    name: z.string(),
    email: z.string(),
    phone: z.string().nullable(),
  }),
  booking: z.object({
    id: z.uuid(),
    status: z.string(),
    startsAt: z.iso.datetime(),
    endsAt: z.iso.datetime(),
    therapist: z.string(),
  }),
  /** Every Checkout attempt, newest first. */
  payments: z.array(
    z.object({
      id: z.uuid(),
      provider: z.string(),
      status: z.string(),
      amountCents: z.number().int(),
      createdAt: z.iso.datetime(),
    }),
  ),
  timeZone: z.string(),
}).meta({ id: 'ConsoleInvoiceDetail' });
export type ConsoleInvoiceDetail = z.infer<typeof ConsoleInvoiceDetailSchema>;
