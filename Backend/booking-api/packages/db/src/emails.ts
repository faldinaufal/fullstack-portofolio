// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

/**
 * Emails exchanged through the `email_messages` outbox. The API writes a template name and
 * its data; the worker renders and sends it. Keeping the data shape here lets both sides
 * type-check against the same definition. Import from `@tempora/db/emails`, which does not
 * load the Prisma client.
 */
/**
 * What every booking email says about the booking. A `type`, not an `interface`, so it fits
 * Prisma's JSON column type (interfaces have no implicit index signature).
 */
export type BookingEmailDetails = {
  name: string;
  businessName: string;
  serviceName: string;
  therapist: string;
  /** Formatted in the platform time zone, e.g. "Monday 23 November 2026 at 10:00". */
  when: string;
  branchName: string;
  address: string | null;
  /** My bookings for a linked account, else the guest link. */
  bookingUrl: string;
};

export interface EmailPayloads {
  'console.login_code': { name: string; code: string; expiresInMinutes: number };
  'console.password_reset': { name: string; resetUrl: string; expiresInMinutes: number };
  'console.password_changed': { name: string };
  'portal.verify_email': { name: string; verifyUrl: string; expiresInHours: number };
  'portal.password_reset': { name: string; resetUrl: string; expiresInMinutes: number };
  'portal.password_changed': { name: string };
  'portal.booking_confirmed': BookingEmailDetails & { invoiceNumber: string; priceCents: number };
  'portal.booking_reminder': BookingEmailDetails;
  'portal.booking_rescheduled': BookingEmailDetails & {
    previousWhen: string;
    previousTherapist: string;
  };
  'portal.booking_cancelled': BookingEmailDetails & {
    reason: string | null;
    /** Paid booking cancelled by the business: it refunds the customer outside Tempora. */
    refundByBusiness: boolean;
  };
  'console.payment_needs_attention': { name: string; bookingId: string };
  'admin.login_code': { name: string; code: string; expiresInMinutes: number };
  'console.tenant_suspended': { name: string; businessName: string; reason: string };
  'console.tenant_reactivated': { name: string; businessName: string; consoleUrl: string };
  'console.invitation': {
    businessName: string;
    inviterName: string;
    role: 'owner' | 'manager' | 'staff';
    branchName: string | null;
    acceptUrl: string;
    expiresInDays: number;
  };
}

export type EmailTemplate = keyof EmailPayloads;

export interface OutboxEmail<T extends EmailTemplate = EmailTemplate> {
  /** Null for account emails (codes, password reset) that belong to no tenant. */
  tenantId: string | null;
  to: string;
  template: T;
  payload: EmailPayloads[T];
}

/** Maximum delivery attempts before a message is marked `failed` (FSD 8.5). */
export const EMAIL_MAX_ATTEMPTS = 5;

/** The demo inbox keeps a day of emails, at most this many (FSD 4.3). */
export const DEMO_INBOX_LIMIT = 500;
export const DEMO_INBOX_RETENTION_MS = 24 * 60 * 60 * 1000;

/**
 * Whether an address belongs to the demo address domain (FSD 10.3): its emails go to the public
 * demo inbox instead of being sent. The worker and the API decide with this one rule.
 */
export function isDemoAddress(email: string, demoDomain: string): boolean {
  return email.trim().toLowerCase().endsWith(`@${demoDomain.toLowerCase()}`);
}
