// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { ConsoleBooking } from '@tempora/contracts';
import type { Prisma, Tx } from '@tempora/db';
import { recordAudit } from '../../lib/audit.js';
import { wallTimeToInstant } from '../availability/engine.js';
import { auditActor } from '../branches/service.js';
import type { Scope } from '../console-auth/access.js';
import type { ConsoleActor } from '../console-auth/guard.js';
import { canSeeCustomerContact, effectiveStatus } from './access.js';

/** A booking row as the Console's tables show it (bookings, a customer's bookings). */
export const BOOKING_ROW_INCLUDE = {
  branch: { select: { id: true, name: true } },
  staff: { include: { teamAccount: { select: { name: true } } } },
  tenantCustomer: true,
  invoice: { select: { id: true, number: true, status: true } },
} as const;

export type BookingRow = Prisma.BookingGetPayload<{ include: typeof BOOKING_ROW_INCLUDE }>;

export function toConsoleBooking(row: BookingRow, actor: Scope, now: Date): ConsoleBooking {
  return {
    id: row.id,
    status: effectiveStatus(row, now) as ConsoleBooking['status'],
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    serviceName: row.serviceName,
    priceCents: row.priceCents,
    branch: row.branch,
    therapist: { id: row.staffMembershipId, name: row.staff.teamAccount.name },
    customer: {
      name: row.tenantCustomer.name,
      email: canSeeCustomerContact(actor) ? row.tenantCustomer.email : null,
    },
    invoice: {
      id: row.invoice?.id ?? row.id,
      number: row.invoice?.number ?? '',
      status: row.invoice?.status ?? 'open',
    },
  };
}

const DAY = 24 * 60 * 60_000;

/** Calendar dates `from`–`to` (both included) as an instant range in the platform time zone. */
export function dateRange(
  timeZone: string,
  from: string | undefined,
  to: string | undefined,
): { gte?: Date; lt?: Date } | undefined {
  if (!from && !to) return undefined;
  const startOf = (date: string) =>
    wallTimeToInstant(date, 0, timeZone) ?? new Date(`${date}T00:00:00Z`);
  const next = (date: string) =>
    new Date(new Date(`${date}T12:00:00Z`).getTime() + DAY).toISOString().slice(0, 10);
  return { ...(from && { gte: startOf(from) }), ...(to && { lt: startOf(next(to)) }) };
}

/**
 * An export takes customer data out of the app, so it is audited (FSD 5.1): which list, the
 * filters and how many rows.
 */
export async function auditExport(
  tx: Tx,
  actor: ConsoleActor,
  list: 'bookings' | 'customers' | 'invoices',
  filters: object,
  rows: number,
): Promise<void> {
  await recordAudit(tx, auditActor(actor), {
    tenantId: actor.tenantId,
    branchId: actor.branchId,
    action: 'export.created',
    entityType: 'export',
    after: { list, filters, rows },
  });
}

/** `bookings-2026-11-23.csv` */
export const exportFileName = (list: string, now: Date) =>
  `${list}-${now.toISOString().slice(0, 10)}.csv`;
