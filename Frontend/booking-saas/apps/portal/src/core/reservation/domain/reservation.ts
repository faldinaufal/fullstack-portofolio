// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

/**
 * A booking someone has made (FSD 2.1 payment, confirmation, My bookings, guest link), as
 * the Portal understands it. "Reservation" keeps it apart from the `booking` feature, which
 * is about choosing a service and a time.
 */

export type ReservationStatus =
  'pending_payment' | 'confirmed' | 'cancelled' | 'expired' | 'completed' | 'no_show';

export interface ReservationSummary {
  id: string;
  status: ReservationStatus;
  business: { slug: string; name: string };
  branchName: string;
  serviceName: string;
  therapist: string;
  /** The therapist's photo (FSD 6.15); null shows the initials. */
  therapistPhotoUrl: string | null;
  startsAt: Date;
  endsAt: Date;
  priceCents: number;
  /** Times are shown in this zone, not the visitor's. */
  timeZone: string;
  invoiceNumber: string;
  /** Decided by the API, so every screen offers the same actions. */
  actions: { pay: boolean; cancel: boolean; reschedule: boolean };
}

export interface Reservation extends ReservationSummary {
  branchId: string;
  serviceId: string;
  staffId: string;
  branchAddress: string | null;
  notes: string | null;
  invoice: {
    number: string;
    status: 'open' | 'paid' | 'void';
    amountCents: number;
    issuedAt: Date;
    paidAt: Date | null;
  };
  /** Pay before this; null when nothing is left to pay. */
  payBy: Date | null;
  /** Confirmed bookings: customer reschedules left and the last moment to move it. */
  rescheduling: { remaining: number; until: Date } | null;
}

export interface RescheduleSlot {
  startsAt: Date;
  endsAt: Date;
}

export type InvoiceStatus = 'open' | 'paid' | 'void';

export interface InvoiceSummary {
  reservationId: string;
  number: string;
  status: InvoiceStatus;
  amountCents: number;
  issuedAt: Date;
  paidAt: Date | null;
  businessName: string;
  serviceName: string;
}

export interface InvoiceQuery {
  page: number;
  status?: InvoiceStatus | undefined;
  /** Invoice number, business or service name. */
  search?: string | undefined;
}

/** Totals on the Invoices page (FSD 5.3 `/invoices/summary`). */
export interface InvoiceTotals {
  year: number;
  paid: { count: number; amountCents: number };
  open: { count: number; amountCents: number };
}

export interface InvoicePage {
  items: InvoiceSummary[];
  page: number;
  pageSize: number;
  total: number;
}

/** Everything a printed invoice shows (FSD 6.10). */
export interface Invoice {
  reservationId: string;
  number: string;
  status: 'open' | 'paid' | 'void';
  currency: string;
  amountCents: number;
  issuedAt: Date;
  paidAt: Date | null;
  voidedAt: Date | null;
  voidReason: string | null;
  business: { name: string; slug: string };
  branch: { name: string; address: string | null };
  billedTo: { name: string; email: string };
  line: { description: string; therapist: string; startsAt: Date; durationMinutes: number };
  timeZone: string;
}

export interface GuestContact {
  name: string;
  email: string;
  phone?: string;
}

export interface NewReservation {
  tenantSlug: string;
  branchId: string;
  serviceId: string;
  staffId: string;
  startsAt: Date;
  notes?: string;
  /** Required unless logged in. */
  guest?: GuestContact;
}

export interface CreatedReservation {
  reservation: ReservationSummary;
  checkoutUrl: string;
  /** Access to this booking without a login (FSD 5.3). */
  accessToken: string;
}

export interface ReservationPage {
  items: ReservationSummary[];
  page: number;
  pageSize: number;
  total: number;
  /** Size of both tabs. */
  counts: { upcoming: number; past: number };
}

/** Implemented by the data layer; failures are `RequestError`s. */
export interface ReservationRepository {
  create(input: NewReservation, idempotencyKey: string): Promise<CreatedReservation>;
  /** With a session, a booking link token, or both. */
  get(id: string, accessToken: string | null): Promise<Reservation>;
  /** The booking a guest link belongs to (`/manage/[token]`). */
  getByLink(token: string): Promise<Reservation>;
  list(when: 'upcoming' | 'past', page: number): Promise<ReservationPage>;
  /** The Checkout URL that is still open. */
  resumePayment(id: string, accessToken: string | null): Promise<string>;
  cancel(id: string, accessToken: string | null): Promise<Reservation>;
  /** Free times to move to (FSD 6.5); the booking's own time does not count as taken. */
  rescheduleSlots(
    id: string,
    accessToken: string | null,
    query: { date: string; staffId: string },
  ): Promise<RescheduleSlot[]>;
  reschedule(
    id: string,
    accessToken: string | null,
    input: { startsAt: Date; staffId: string },
  ): Promise<Reservation>;
  invoice(id: string, accessToken: string | null): Promise<Invoice>;
  invoices(query: InvoiceQuery): Promise<InvoicePage>;
  invoiceTotals(): Promise<InvoiceTotals>;
}

/**
 * Keeps each booking's access token for this browser tab, so the payment and confirmation
 * pages work without a login and without putting the token in a URL (FSD 5.3).
 */
export interface BookingAccessStore {
  get(reservationId: string): string | null;
  save(reservationId: string, token: string): void;
}

/** Books the slot and remembers its access token; returns where to pay (FSD 3.1). */
export async function reserve(
  repository: ReservationRepository,
  access: BookingAccessStore,
  input: NewReservation,
  idempotencyKey: string,
): Promise<CreatedReservation> {
  const created = await repository.create(input, idempotencyKey);
  access.save(created.reservation.id, created.accessToken);
  return created;
}

/** Milliseconds left to pay, never negative. */
export function timeLeft(payBy: Date | null, now: Date): number {
  return payBy ? Math.max(0, payBy.getTime() - now.getTime()) : 0;
}

/** "29:05" for a countdown. */
export function formatCountdown(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/** The confirmation page waits for the payment webhook this long before it stops polling. */
export const CONFIRMATION_WAIT_MS = 90_000;

/**
 * FSD 6.4: the page after Checkout does not trust the redirect; it asks again until the
 * webhook has decided, or gives up after a while (the email will follow).
 */
export function keepWaitingForPayment(
  status: ReservationStatus | undefined,
  waitingSince: Date,
  now: Date,
): boolean {
  return (
    (status === undefined || status === 'pending_payment') &&
    now.getTime() - waitingSince.getTime() < CONFIRMATION_WAIT_MS
  );
}

/**
 * Why a confirmed booking can or cannot be moved online (FSD 6.5), for the line next to
 * the "Reschedule" button. Null when the booking is not confirmed.
 */
export function rescheduleNotice(
  reservation: Pick<Reservation, 'rescheduling' | 'actions'>,
): { allowed: boolean; message: string } | null {
  const rules = reservation.rescheduling;
  if (!rules) return null;
  if (reservation.actions.reschedule) {
    const left = rules.remaining === 1 ? '1 change left' : `${rules.remaining} changes left`;
    return { allowed: true, message: left };
  }
  if (rules.remaining === 0) {
    return {
      allowed: false,
      message:
        'This booking has been moved as often as allowed. Contact the business to change it.',
    };
  }
  return {
    allowed: false,
    message: 'It is too close to the session to move it online. Contact the business to change it.',
  };
}
