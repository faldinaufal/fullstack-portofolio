// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

/** A business's public page and the first booking steps, as the Portal understands them. */

export interface OpeningHours {
  /** 0 = Sunday. */
  weekday: number;
  opensAt: string;
  closesAt: string;
}

export interface Closure {
  startsOn: string;
  endsOn: string;
  reason: string;
}

export interface PublicService {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  priceCents: number;
}

export interface PublicBranch {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  openingHours: OpeningHours[];
  closures: Closure[];
}

/** Booking rules the business has set (FSD 6.1, 6.5), shown on its page. */
export interface BookingPolicy {
  minLeadHours: number;
  cancellationCutoffHours: number;
  maxCustomerReschedules: number;
}

export interface BusinessPage {
  slug: string;
  name: string;
  available: boolean;
  timeZone: string;
  maxAdvanceDays: number;
  policy: BookingPolicy;
  /** Uploaded by the owner (FSD 6.15); null shows initials and the brand gradient. */
  logoUrl: string | null;
  coverUrl: string | null;
  branches: PublicBranch[];
  services: PublicService[];
}

export interface Therapist {
  id: string;
  displayName: string;
  /** Uploaded in the Console (FSD 6.15); null shows the initials. */
  photoUrl: string | null;
  serviceIds: string[];
}

export interface BranchPage extends PublicBranch {
  business: { slug: string; name: string; available: boolean };
  therapists: Therapist[];
  services: PublicService[];
}

export interface Slot {
  startsAt: Date;
  endsAt: Date;
}

export interface SlotQuery {
  branchId: string;
  serviceId: string;
  staffId: string;
  /** `YYYY-MM-DD` in the business's time zone. */
  date: string;
}

export interface BookingRepository {
  getBusiness(slug: string): Promise<BusinessPage>;
  getBranch(slug: string, branchId: string): Promise<BranchPage>;
  getSlots(slug: string, query: SlotQuery): Promise<Slot[]>;
}

const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

/** "Mon–Fri 09:00–18:00 · Sat 10:00–14:00", or "Closed" with no hours. */
export function summarizeHours(hours: OpeningHours[]): string {
  const byDay = new Map(hours.map((h) => [h.weekday, `${h.opensAt}–${h.closesAt}`]));
  const groups: { from: number; to: number; time: string }[] = [];
  WEEK_ORDER.forEach((day, index) => {
    const time = byDay.get(day);
    if (!time) return;
    const last = groups.at(-1);
    if (last && last.time === time && last.to === WEEK_ORDER[index - 1]) last.to = day;
    else groups.push({ from: day, to: day, time });
  });
  if (groups.length === 0) return 'Closed';
  return groups
    .map((g) => {
      const days =
        g.from === g.to
          ? WEEKDAYS_SHORT[g.from]
          : `${WEEKDAYS_SHORT[g.from]}–${WEEKDAYS_SHORT[g.to]}`;
      return `${days} ${g.time}`;
    })
    .join(' · ');
}

/** Calendar date `YYYY-MM-DD` of an instant in a time zone. */
export function dateIn(timeZone: string, instant: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export interface BookableDay {
  date: string;
  weekday: number;
  /** False when the branch is closed that weekday or for a closure. */
  open: boolean;
}

/**
 * The dates a customer can pick: today up to the booking horizon, in the business's time
 * zone, with closed days marked. The API still decides the actual free times.
 */
export function bookableDays(
  branch: Pick<PublicBranch, 'openingHours' | 'closures'>,
  maxAdvanceDays: number,
  timeZone: string,
  now: Date,
): BookableDay[] {
  const openWeekdays = new Set(branch.openingHours.map((h) => h.weekday));
  const first = new Date(`${dateIn(timeZone, now)}T12:00:00Z`);
  return Array.from({ length: maxAdvanceDays + 1 }, (_, offset) => {
    const day = new Date(first);
    day.setUTCDate(first.getUTCDate() + offset);
    const date = day.toISOString().slice(0, 10);
    const weekday = day.getUTCDay();
    const closed = branch.closures.some((c) => c.startsOn <= date && date <= c.endsOn);
    return { date, weekday, open: openWeekdays.has(weekday) && !closed };
  });
}

/** Therapists of a branch who perform a service. */
export function therapistsFor(
  branch: Pick<BranchPage, 'therapists'>,
  serviceId: string,
): Therapist[] {
  return branch.therapists.filter((t) => t.serviceIds.includes(serviceId));
}

const plural = (count: number, one: string, many = `${one}s`) =>
  `${count} ${count === 1 ? one : many}`;

/**
 * The policy as short sentences for the business page. Payment is always taken at booking
 * and an unpaid hold lasts 30 minutes (FSD 6.3); cancelling online is only for unpaid
 * bookings (FSD 6.7).
 */
export function policyLines(policy: BookingPolicy, maxAdvanceDays: number): string[] {
  const reschedules =
    policy.maxCustomerReschedules === 0
      ? 'Contact the business to move a confirmed booking.'
      : `Reschedule online up to ${plural(policy.cancellationCutoffHours, 'hour')} before the session, ${plural(policy.maxCustomerReschedules, 'time')} per booking.`;
  return [
    policy.minLeadHours > 0
      ? `Book at least ${plural(policy.minLeadHours, 'hour')} ahead, up to ${plural(maxAdvanceDays, 'day')} ahead.`
      : `Book up to ${plural(maxAdvanceDays, 'day')} ahead.`,
    'Pay when you book: the time is held for 30 minutes while you pay.',
    reschedules,
  ];
}

export interface DayHours {
  weekday: number;
  label: string;
  /** "09:00–18:00", or null when closed. */
  hours: string | null;
}

const WEEKDAYS_LONG = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

/** One row per weekday, Monday first, for an opening-hours table. */
export function weekHours(hours: OpeningHours[]): DayHours[] {
  const byDay = new Map(hours.map((h) => [h.weekday, `${h.opensAt}–${h.closesAt}`]));
  return WEEK_ORDER.map((weekday) => ({
    weekday,
    label: WEEKDAYS_LONG[weekday]!,
    hours: byDay.get(weekday) ?? null,
  }));
}
