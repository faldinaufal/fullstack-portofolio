// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { Prisma } from '@tempora/db';
import { calendarDateOf, todayIn, wallTimeToInstant } from '../availability/engine.js';
import { formatInvoiceNumber } from '../bookings/invoice-number.js';
import { addDays } from '../reports/calc.js';
import {
  CANCEL_REASONS,
  DEMO_ACCOUNTS,
  DEMO_TENANTS,
  FIRST_NAMES,
  LAST_NAMES,
  NOTES,
  type DemoMember,
  type DemoTenant,
} from './world.js';

/**
 * The demo data as plain rows (FSD 10.3), built from "now" and the platform time zone only:
 * the same inputs give the same rows, so the seed is reproducible and testable without a
 * database. It follows the database's rules (one active booking per therapist at a time,
 * the booking grid, gapless invoice numbers, statuses and their timestamps) so the API treats
 * the demo exactly like real data.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
/** Bookings start on this grid (the availability engine's slot interval). */
const GRID = 30;
const PAST_DAYS = 90;
const FUTURE_DAYS = 14;

/** IDs of demo rows start with `fa1d`; `kind` keeps each table's IDs apart. */
export function demoId(kind: number, n: number): string {
  return `fa1d${kind.toString(16).padStart(4, '0')}-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;
}

const KIND = {
  tenant: 1,
  branch: 2,
  service: 3,
  teamAccount: 4,
  membership: 5,
  customerAccount: 6,
  tenantCustomer: 7,
  booking: 8,
  invoice: 9,
  payment: 10,
  opening: 11,
  working: 12,
  audit: 13,
  email: 14,
  admin: 15,
} as const;

export const DEMO_TENANT_IDS = DEMO_TENANTS.map((_, i) => demoId(KIND.tenant, i + 1));

/** Small, fast, seeded random numbers (mulberry32): the same seed, the same demo. */
function random(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
  return {
    next,
    int: (min: number, max: number) => min + Math.floor(next() * (max - min + 1)),
    pick: <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)]!,
    chance: (p: number) => next() < p,
  };
}

const minutesOf = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h! * 60 + m!;
};
const timeOfDay = (minutes: number) =>
  new Date(Date.UTC(1970, 0, 1, Math.floor(minutes / 60), minutes % 60));
const weekdayOf = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();

/** A therapist's hours on a weekday, inside the branch's opening hours; null when off. */
function workingWindow(
  member: DemoMember,
  tenant: DemoTenant,
  weekday: number,
): [number, number] | null {
  const open = tenant.opening[weekday];
  if (!member.hours || !open || !member.hours.weekdays.includes(weekday)) return null;
  const from = Math.max(minutesOf(member.hours.from), minutesOf(open[0]));
  const to = Math.min(minutesOf(member.hours.to), minutesOf(open[1]));
  return from < to ? [from, to] : null;
}

/** Who cancelled (FSD 6.7): the team for a paid booking, else the customer or the guest. */
function cancelledByTypeOf(
  paid: boolean,
  team: 'owner' | 'manager',
  hasAccount: boolean,
): 'owner' | 'manager' | 'customer' | 'guest' {
  if (paid) return team;
  return hasAccount ? 'customer' : 'guest';
}

function cancelledByIdOf(
  paid: boolean,
  teamId: string,
  hasAccount: boolean,
  customerAccountId: string,
): string | null {
  if (paid) return teamId;
  return hasAccount ? customerAccountId : null;
}

export interface DemoPlan {
  tenants: Prisma.TenantCreateManyInput[];
  branches: Prisma.BranchCreateManyInput[];
  openingHours: Prisma.BranchOpeningHoursCreateManyInput[];
  services: Prisma.ServiceCreateManyInput[];
  teamAccounts: Prisma.TeamAccountCreateManyInput[];
  memberships: Prisma.MembershipCreateManyInput[];
  staffServices: Prisma.StaffServiceCreateManyInput[];
  workingHours: Prisma.StaffWorkingHoursCreateManyInput[];
  customerAccounts: Prisma.CustomerAccountCreateManyInput[];
  tenantCustomers: Prisma.TenantCustomerCreateManyInput[];
  bookings: Prisma.BookingCreateManyInput[];
  invoices: Prisma.InvoiceCreateManyInput[];
  invoiceCounters: Prisma.InvoiceCounterCreateManyInput[];
  payments: Prisma.PaymentCreateManyInput[];
  auditLogs: Prisma.AuditLogCreateManyInput[];
  emails: Prisma.EmailMessageCreateManyInput[];
  platformAdmins: Prisma.PlatformAdminCreateManyInput[];
}

export interface DemoPlanInput {
  now: Date;
  timeZone: string;
  /** One Argon2 hash of the demo password, shared by every demo account. */
  passwordHash: string;
  portalUrl: string;
  /** Invoice prefix per demo slug when the usual one is taken by another business. */
  invoicePrefixes?: Partial<Record<string, string>>;
}

export function buildDemoPlan({
  now,
  timeZone,
  passwordHash,
  portalUrl,
  invoicePrefixes = {},
}: DemoPlanInput): DemoPlan {
  const rng = random(4217);
  const counter: Record<number, number> = {};
  const id = (kind: number) => demoId(kind, (counter[kind] = (counter[kind] ?? 0) + 1));
  const plan: DemoPlan = {
    tenants: [],
    branches: [],
    openingHours: [],
    services: [],
    teamAccounts: [],
    memberships: [],
    staffServices: [],
    workingHours: [],
    customerAccounts: [],
    tenantCustomers: [],
    bookings: [],
    invoices: [],
    invoiceCounters: [],
    payments: [],
    auditLogs: [],
    emails: [],
    platformAdmins: [],
  };
  const created = new Date(now.getTime() - (PAST_DAYS + 30) * DAY);
  const today = todayIn(timeZone, now);

  // The demo customer has one Portal account, used at both businesses (FSD 3.2 "My bookings").
  const customerAccountId = id(KIND.customerAccount);
  plan.customerAccounts.push({
    id: customerAccountId,
    email: DEMO_ACCOUNTS.customer.email,
    name: DEMO_ACCOUNTS.customer.name,
    phone: DEMO_ACCOUNTS.customer.phone,
    passwordHash,
    emailVerifiedAt: created,
    passwordChangedAt: created,
    createdAt: created,
    updatedAt: created,
  });

  plan.platformAdmins.push({
    id: id(KIND.admin),
    email: DEMO_ACCOUNTS.admin.email,
    name: DEMO_ACCOUNTS.admin.name,
    passwordHash,
    passwordChangedAt: created,
    createdAt: created,
    updatedAt: created,
  });

  const teamNames = new Set(DEMO_TENANTS.flatMap((tenant) => tenant.team.map((m) => m.name)));
  DEMO_TENANTS.forEach((tenant, t) => {
    const peopleUsed = new Set([...teamNames, DEMO_ACCOUNTS.customer.name]);
    const tenantId = DEMO_TENANT_IDS[t]!;
    const prefix = invoicePrefixes[tenant.slug] ?? tenant.invoicePrefix;
    plan.tenants.push({
      id: tenantId,
      slug: tenant.slug,
      name: tenant.name,
      invoicePrefix: prefix,
      createdAt: created,
      updatedAt: created,
    });

    const branchIds = new Map<string, string>();
    for (const branch of tenant.branches) {
      const branchId = id(KIND.branch);
      branchIds.set(branch.key, branchId);
      plan.branches.push({
        id: branchId,
        tenantId,
        name: branch.name,
        address: branch.address,
        phone: branch.phone,
        createdAt: created,
        updatedAt: created,
      });
      for (const [weekday, [from, to]] of Object.entries(tenant.opening)) {
        plan.openingHours.push({
          id: id(KIND.opening),
          tenantId,
          branchId,
          weekday: Number(weekday),
          opensAt: timeOfDay(minutesOf(from)),
          closesAt: timeOfDay(minutesOf(to)),
        });
      }
    }

    const services = new Map(
      tenant.services.map((service) => {
        const serviceId = id(KIND.service);
        plan.services.push({
          id: serviceId,
          tenantId,
          name: service.name,
          description: service.description,
          durationMinutes: service.durationMinutes,
          bufferMinutes: service.bufferMinutes,
          priceCents: service.priceCents,
          createdAt: created,
          updatedAt: created,
        });
        return [service.key, { ...service, id: serviceId }];
      }),
    );

    const therapists: { member: DemoMember; membershipId: string; branchId: string }[] = [];
    let ownerMembershipId = '';
    const managerOf = new Map<string, { id: string; name: string }>();
    for (const member of tenant.team) {
      const accountId = id(KIND.teamAccount);
      const membershipId = id(KIND.membership);
      plan.teamAccounts.push({
        id: accountId,
        email: member.email,
        name: member.name,
        passwordHash,
        emailVerifiedAt: created,
        passwordChangedAt: created,
        createdAt: created,
        updatedAt: created,
      });
      const branchId = member.branch ? branchIds.get(member.branch)! : null;
      plan.memberships.push({
        id: membershipId,
        tenantId,
        teamAccountId: accountId,
        role: member.role,
        branchId,
        createdAt: created,
        updatedAt: created,
      });
      if (member.role === 'owner') ownerMembershipId = membershipId;
      if (member.role === 'manager' && branchId) {
        managerOf.set(branchId, { id: membershipId, name: member.name });
      }
      for (const key of member.services ?? []) {
        plan.staffServices.push({ tenantId, membershipId, serviceId: services.get(key)!.id });
      }
      if (member.hours && branchId) {
        for (let weekday = 0; weekday <= 6; weekday += 1) {
          const window = workingWindow(member, tenant, weekday);
          if (!window) continue;
          plan.workingHours.push({
            id: id(KIND.working),
            tenantId,
            membershipId,
            weekday,
            startsAt: timeOfDay(window[0]),
            endsAt: timeOfDay(window[1]),
          });
        }
        therapists.push({ member, membershipId, branchId });
      }
    }

    // Customers: the demo customer (linked to the account) and regulars with guest records.
    const customers: { id: string; name: string; account: boolean; firstAt: Date | null }[] = [];
    const addCustomer = (name: string, email: string, phone: string | null, account: boolean) => {
      const customerId = id(KIND.tenantCustomer);
      plan.tenantCustomers.push({
        id: customerId,
        tenantId,
        customerAccountId: account ? customerAccountId : null,
        email,
        name,
        phone,
        firstBookedAt: created, // replaced by the first booking below
        createdAt: created,
        updatedAt: created,
      });
      customers.push({ id: customerId, name, account, firstAt: null });
    };
    addCustomer(
      DEMO_ACCOUNTS.customer.name,
      DEMO_ACCOUNTS.customer.email,
      DEMO_ACCOUNTS.customer.phone,
      true,
    );
    for (let n = 0; customers.length <= tenant.customers && n < 600; n += 1) {
      const first = FIRST_NAMES[(n * 7 + t * 3) % FIRST_NAMES.length]!;
      const last = LAST_NAMES[(n * 3 + t) % LAST_NAMES.length]!;
      const name = `${first} ${last}`;
      if (peopleUsed.has(name)) continue;
      peopleUsed.add(name);
      const email = `${first}.${last}`.toLowerCase().replace(/[^a-z.]/g, '') + '@veloria.test';
      const phone = rng.chance(0.7) ? `+15550147${String(100 + customers.length).slice(-3)}` : null;
      addCustomer(name, email, phone, false);
    }
    // A few regulars book much more often than the rest.
    const pickCustomer = () =>
      rng.chance(0.35)
        ? customers[rng.int(1, Math.min(8, customers.length - 1))]!
        : rng.pick(customers);

    // Bookings, day by day, therapist by therapist.
    type Draft = {
      id: string;
      branchId: string;
      membershipId: string;
      therapist: string;
      service: {
        id: string;
        name: string;
        durationMinutes: number;
        bufferMinutes: number;
        priceCents: number;
      };
      customer: (typeof customers)[number];
      startsAt: Date;
      endsAt: Date;
      blockedUntil: Date;
      createdAt: Date;
    };
    const drafts: Draft[] = [];
    for (let offset = -PAST_DAYS; offset <= FUTURE_DAYS; offset += 1) {
      const date = addDays(today, offset);
      const weekday = weekdayOf(date);
      for (const therapist of therapists) {
        const window = workingWindow(therapist.member, tenant, weekday);
        if (!window) continue;
        const offered = (therapist.member.services ?? []).map((key) => services.get(key)!);
        // Busier closer to today, a little emptier further ahead (not booked yet).
        const fill = offset > 3 ? tenant.occupancy * 0.55 : tenant.occupancy;
        let cursor = window[0];
        while (cursor < window[1]) {
          const service = rng.pick(offered);
          const end = cursor + service.durationMinutes + service.bufferMinutes;
          if (end > window[1]) break;
          if (rng.chance(fill)) {
            const startsAt = wallTimeToInstant(date, cursor, timeZone);
            if (startsAt) {
              const lead = rng.int(1, 21) * DAY + rng.int(0, 20) * HOUR;
              let createdAt = new Date(startsAt.getTime() - lead);
              if (createdAt >= now) createdAt = new Date(now.getTime() - rng.int(1, 60) * HOUR);
              drafts.push({
                id: id(KIND.booking),
                branchId: therapist.branchId,
                membershipId: therapist.membershipId,
                therapist: therapist.member.name,
                service,
                customer: pickCustomer(),
                startsAt,
                endsAt: new Date(startsAt.getTime() + service.durationMinutes * MINUTE),
                blockedUntil: new Date(
                  startsAt.getTime() + (service.durationMinutes + service.bufferMinutes) * MINUTE,
                ),
                createdAt,
              });
            }
            cursor = Math.ceil(end / GRID) * GRID;
          } else {
            cursor += GRID * rng.int(1, 2);
          }
        }
      }
    }

    // The demo customer always has something to look at: upcoming visits, one of them
    // far enough ahead to reschedule, and a few past ones.
    const demo = customers[0]!;
    const upcoming = drafts.filter((d) => d.startsAt.getTime() > now.getTime() + 2 * DAY);
    const past = drafts.filter((d) => d.endsAt.getTime() < now.getTime() - 2 * DAY);
    for (const d of [upcoming[0], upcoming[Math.floor(upcoming.length / 2)]])
      if (d) d.customer = demo;
    for (let i = 0; i < 3 && past.length > 0; i += 1) past[(i * 37) % past.length]!.customer = demo;

    // Invoices are numbered in the order the bookings were made (FSD 6.10).
    drafts.sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id),
    );
    const sequence = new Map<number, number>();
    for (const draft of drafts) {
      const ended = draft.endsAt.getTime() <= now.getTime();
      const longAgo = draft.endsAt.getTime() < now.getTime() - DAY;
      const started = draft.startsAt.getTime() <= now.getTime();
      const roll = rng.next();

      // What happened to it.
      let status: 'confirmed' | 'completed' | 'no_show' | 'cancelled' | 'expired' = 'confirmed';
      if (roll < 0.03) status = 'expired';
      else if (roll < 0.1) status = 'cancelled';
      else if (longAgo) status = roll < 0.16 ? 'no_show' : 'completed';
      else if (ended && rng.chance(0.6)) status = 'completed';
      if (status === 'cancelled' && started && !longAgo) status = 'confirmed';
      const paidCancel = status === 'cancelled' && rng.chance(0.5);
      const paid = status !== 'expired' && (status !== 'cancelled' || paidCancel);

      const year = Number(calendarDateOf(draft.createdAt, timeZone).slice(0, 4));
      const n = (sequence.get(year) ?? 0) + 1;
      sequence.set(year, n);
      const invoiceId = id(KIND.invoice);
      const paidAt = new Date(draft.createdAt.getTime() + rng.int(2, 20) * MINUTE);
      const holdExpiresAt = new Date(draft.createdAt.getTime() + 32 * MINUTE);
      // Cancelled after it was made (and paid, for a paid one), before it started.
      const cancelledAt =
        status === 'cancelled'
          ? new Date(
              Math.max(
                (paidCancel ? paidAt : draft.createdAt).getTime() + MINUTE,
                Math.min(
                  draft.startsAt.getTime() - HOUR,
                  draft.createdAt.getTime() + (paidCancel ? rng.int(1, 5) * DAY : 10 * MINUTE),
                  now.getTime() - MINUTE,
                ),
              ),
            )
          : null;
      const cancelReason = paidCancel
        ? rng.pick(CANCEL_REASONS)
        : cancelledAt
          ? 'Cancelled before payment'
          : null;
      const markedAt =
        status === 'completed' || status === 'no_show'
          ? new Date(Math.min(draft.endsAt.getTime() + rng.int(1, 20) * HOUR, now.getTime()))
          : null;
      const markedByTherapist = rng.chance(0.7);
      // A paid booking is cancelled by the team: the branch manager or the owner.
      const manager = managerOf.get(draft.branchId);
      const canceller =
        manager && rng.chance(0.5)
          ? { type: 'manager' as const, id: manager.id, name: manager.name }
          : { type: 'owner' as const, id: ownerMembershipId, name: tenant.team[0]!.name };

      plan.bookings.push({
        id: draft.id,
        tenantId,
        branchId: draft.branchId,
        serviceId: draft.service.id,
        staffMembershipId: draft.membershipId,
        tenantCustomerId: draft.customer.id,
        startsAt: draft.startsAt,
        endsAt: draft.endsAt,
        blockedUntil: draft.blockedUntil,
        status,
        holdExpiresAt: status === 'expired' ? holdExpiresAt : null,
        serviceName: draft.service.name,
        durationMinutes: draft.service.durationMinutes,
        bufferMinutes: draft.service.bufferMinutes,
        priceCents: draft.service.priceCents,
        customerNotes: rng.chance(0.18) ? rng.pick(NOTES) : null,
        cancelReason,
        cancelledAt,
        cancelledByType: cancelledAt
          ? cancelledByTypeOf(paidCancel, canceller.type, draft.customer.account)
          : null,
        cancelledById: cancelledAt
          ? cancelledByIdOf(paidCancel, canceller.id, draft.customer.account, customerAccountId)
          : null,
        refundHandledExternally: paidCancel,
        markedAt,
        markedByMembershipId: markedAt && markedByTherapist ? draft.membershipId : null,
        version: status === 'confirmed' ? 2 : 3,
        createdAt: draft.createdAt,
        updatedAt: markedAt ?? cancelledAt ?? (paid ? paidAt : holdExpiresAt),
      });

      plan.invoices.push({
        id: invoiceId,
        tenantId,
        bookingId: draft.id,
        number: formatInvoiceNumber(prefix, year, n),
        status: paid ? 'paid' : 'void',
        amountCents: draft.service.priceCents,
        issuedAt: draft.createdAt,
        paidAt: paid ? paidAt : null,
        voidedAt: paid ? null : (cancelledAt ?? holdExpiresAt),
        voidReason: paid ? null : cancelledAt ? 'Booking cancelled' : 'Hold expired',
      });

      const paymentId = id(KIND.payment);
      plan.payments.push({
        id: paymentId,
        tenantId,
        invoiceId,
        provider: 'demo',
        checkoutSessionId: `demo_cs_${paymentId.slice(-12)}`,
        checkoutUrl: `${portalUrl}/pay/demo/${paymentId.slice(-12)}`,
        paymentIntentId: paid ? `demo_pi_${paymentId.slice(-12)}` : null,
        status: paid ? 'succeeded' : 'expired',
        amountCents: draft.service.priceCents,
        expiresAt: new Date(draft.createdAt.getTime() + 30 * MINUTE),
        createdAt: draft.createdAt,
        updatedAt: paid ? paidAt : holdExpiresAt,
      });

      if (!draft.customer.firstAt || draft.createdAt < draft.customer.firstAt) {
        draft.customer.firstAt = draft.createdAt;
      }

      // The booking's history, as the API would have written it (its timeline).
      const who = draft.customer.account ? draft.customer.name : `${draft.customer.name} (guest)`;
      const audit = (
        at: Date,
        actor: { type: 'team_member' | 'customer' | 'system'; id: string | null; label: string },
        action: string,
        before: object | null,
        after: object,
        reason: string | null = null,
      ) =>
        plan.auditLogs.push({
          id: id(KIND.audit),
          tenantId,
          branchId: draft.branchId,
          actorType: actor.type,
          actorId: actor.id,
          actorLabel: actor.label,
          action,
          entityType: 'booking',
          entityId: draft.id,
          ...(before && { before }),
          after,
          reason,
          createdAt: at,
        });
      const customerActor = {
        type: 'customer' as const,
        id: draft.customer.account ? customerAccountId : null,
        label: who,
      };
      audit(draft.createdAt, customerActor, 'booking.created', null, {
        status: 'pending_payment',
        startsAt: draft.startsAt.toISOString(),
        staffId: draft.membershipId,
        invoice: formatInvoiceNumber(prefix, year, n),
      });
      if (paid) {
        audit(
          paidAt,
          { type: 'system', id: null, label: 'Payment provider (demo)' },
          'booking.confirmed',
          { status: 'pending_payment' },
          { status: 'confirmed' },
        );
      }
      if (status === 'expired') {
        audit(
          holdExpiresAt,
          { type: 'system', id: null, label: 'Hold expiry' },
          'booking.expired',
          { status: 'pending_payment' },
          { status: 'expired' },
        );
      }
      if (cancelledAt) {
        audit(
          cancelledAt,
          paidCancel
            ? { type: 'team_member', id: canceller.id, label: canceller.name }
            : customerActor,
          'booking.cancelled',
          { status: paidCancel ? 'confirmed' : 'pending_payment' },
          { status: 'cancelled' },
          cancelReason,
        );
      }
      if (markedAt) {
        audit(
          markedAt,
          markedByTherapist
            ? { type: 'team_member', id: draft.membershipId, label: draft.therapist }
            : { type: 'system', id: null, label: 'Auto-complete job' },
          `booking.${status}`,
          { status: 'confirmed' },
          { status },
        );
      }

      // The emails of the last two weeks, already sent (the content is erased once sent).
      if (paid && draft.createdAt.getTime() > now.getTime() - 14 * DAY) {
        plan.emails.push({
          id: id(KIND.email),
          tenantId,
          branchId: draft.branchId,
          toEmail: plan.tenantCustomers.find((c) => c.id === draft.customer.id)!.email,
          template: 'portal.booking_confirmed',
          status: 'sent',
          attempts: 1,
          createdAt: paidAt,
          nextAttemptAt: paidAt,
          sentAt: new Date(paidAt.getTime() + 4000),
        });
      }
    }
    for (const [year, last] of sequence) {
      plan.invoiceCounters.push({ tenantId, year, nextValue: last + 1 });
    }
    for (const customer of customers) {
      const row = plan.tenantCustomers.find((c) => c.id === customer.id)!;
      row.firstBookedAt = customer.firstAt ?? created;
    }
  });

  return plan;
}
