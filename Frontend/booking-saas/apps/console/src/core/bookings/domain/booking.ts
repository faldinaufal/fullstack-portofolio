// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

/** Bookings as the Console works with them (FSD 2.2 Bookings, Booking detail, Calendar, Today). */

export type BookingStatus =
  'pending_payment' | 'confirmed' | 'cancelled' | 'expired' | 'completed' | 'no_show';

export interface BookingRow {
  id: string;
  status: BookingStatus;
  startsAt: Date;
  endsAt: Date;
  serviceName: string;
  priceCents: number;
  branch: { id: string; name: string };
  therapist: { id: string; name: string };
  /** Email is null for staff. */
  customer: { name: string; email: string | null };
  invoice: { number: string; status: 'open' | 'paid' | 'void' };
}

export interface BookingPage {
  items: BookingRow[];
  page: number;
  pageSize: number;
  total: number;
  timeZone: string;
}

export interface BookingFilters {
  status?: BookingStatus | undefined;
  branchId?: string | undefined;
  /** `YYYY-MM-DD`, both included. */
  from?: string | undefined;
  to?: string | undefined;
  q?: string | undefined;
  sort: 'startsAt' | '-startsAt';
  page: number;
}

export interface BookingActions {
  reschedule: boolean;
  reassign: boolean;
  cancel: boolean;
  cancelNeedsReason: boolean;
  complete: boolean;
  noShow: boolean;
}

export interface TimelineEntry {
  at: Date;
  actor: string;
  action: string;
  reason: string | null;
}

export interface BookingDetail extends Omit<BookingRow, 'customer'> {
  customer: { id: string; name: string; email: string | null; phone: string | null };
  serviceId: string;
  notes: string | null;
  durationMinutes: number;
  holdExpiresAt: Date | null;
  cancelReason: string | null;
  refundHandledExternally: boolean;
  timeZone: string;
  actions: BookingActions;
  timeline: TimelineEntry[];
}

export interface CalendarBooking {
  id: string;
  status: BookingStatus;
  startsAt: Date;
  endsAt: Date;
  blockedUntil: Date;
  staffId: string;
  serviceName: string;
  customerName: string;
  notes: string | null;
}

export interface CalendarTimeOff {
  id: string;
  staffId: string;
  startsAt: Date;
  endsAt: Date;
  reason: string | null;
}

export interface CalendarData {
  timeZone: string;
  branch: { id: string; name: string };
  therapists: { id: string; name: string }[];
  bookings: CalendarBooking[];
  timeOff: CalendarTimeOff[];
}

export interface Slot {
  startsAt: Date;
}

/** Implemented by the data layer; failures are `RequestError`s. */
export interface BookingRepository {
  list(filters: BookingFilters): Promise<BookingPage>;
  get(id: string): Promise<BookingDetail>;
  calendar(range: { from: string; to: string; branchId?: string }): Promise<CalendarData>;
  slots(id: string, query: { date: string; staffId: string }): Promise<Slot[]>;
  reschedule(id: string, input: { startsAt: Date; staffId?: string }): Promise<BookingDetail>;
  reassign(id: string, staffId: string): Promise<BookingDetail>;
  cancel(id: string, reason?: string): Promise<BookingDetail>;
  complete(id: string): Promise<BookingDetail>;
  noShow(id: string): Promise<BookingDetail>;
}

const MINUTE = 60_000;

/** Minutes since midnight on the business's wall clock. */
export function minutesInDay(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone,
  }).formatToParts(instant);
  const value = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return value('hour') * 60 + value('minute');
}

/** `YYYY-MM-DD` of an instant in a time zone. */
export function dateIn(timeZone: string, instant: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

/** A calendar date `days` after another (`YYYY-MM-DD`). */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export interface CalendarBlock {
  id: string;
  kind: 'booking' | 'time_off';
  /** Position in the day column, from the top of the visible hours, in minutes. */
  top: number;
  height: number;
  /** The buffer after a session, drawn lighter (FSD 6.2 rule 5). */
  bufferHeight: number;
}

/**
 * Where a booking or a time off sits in a day column that shows `[startHour, endHour)`.
 * Parts outside the visible hours are cut off; nothing visible gives null.
 */
export function placeBlock(
  item: { startsAt: Date; endsAt: Date; blockedUntil?: Date },
  date: string,
  timeZone: string,
  startHour: number,
  endHour: number,
): { top: number; height: number; bufferHeight: number } | null {
  const visibleFrom = startHour * 60;
  const visibleTo = endHour * 60;
  const sameDay = dateIn(timeZone, item.startsAt) === date;
  const start = sameDay ? minutesInDay(item.startsAt, timeZone) : 0;
  const length = (item.endsAt.getTime() - item.startsAt.getTime()) / MINUTE;
  const end = Math.min(start + length, 24 * 60);
  const buffer = item.blockedUntil
    ? (item.blockedUntil.getTime() - item.endsAt.getTime()) / MINUTE
    : 0;
  const top = Math.max(start, visibleFrom);
  const bottom = Math.min(end, visibleTo);
  if (bottom <= top) return null;
  return {
    top: top - visibleFrom,
    height: bottom - top,
    bufferHeight: Math.max(0, Math.min(end + buffer, visibleTo) - bottom),
  };
}
