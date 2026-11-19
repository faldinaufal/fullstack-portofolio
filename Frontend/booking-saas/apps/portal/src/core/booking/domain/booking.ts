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

export interface BusinessPage {
  slug: string;
  name: string;
  available: boolean;
  timeZone: string;
  maxAdvanceDays: number;
  branches: PublicBranch[];
  services: PublicService[];
}

export interface Therapist {
  id: string;
  displayName: string;
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
