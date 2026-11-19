// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { PortalBooking, PortalBookingDetail } from '@tempora/contracts';
import type { Tx } from '@tempora/db';
import { displayName } from '../public/service.js';

const INCLUDE = {
  tenant: {
    select: { slug: true, name: true, cancellationCutoffHours: true, maxCustomerReschedules: true },
  },
  branch: { select: { name: true, address: true } },
  staff: { include: { teamAccount: { select: { name: true } } } },
  invoice: { include: { payments: { orderBy: { createdAt: 'desc' as const } } } },
} as const;

type BookingRow = Awaited<ReturnType<typeof loadRows>>[number];

const loadRows = (tx: Tx, ids: string[]) =>
  tx.booking.findMany({ where: { id: { in: ids } }, include: INCLUDE });

/**
 * A hold that ran out is shown as expired straight away, even in the minute before the
 * worker records it (FSD 6.4): the slot is already free for others.
 */
function effectiveStatus(row: BookingRow, now: Date): PortalBooking['status'] {
  if (row.status === 'pending_payment' && (!row.holdExpiresAt || row.holdExpiresAt <= now)) {
    return 'expired';
  }
  return row.status;
}

function toPortalBooking(row: BookingRow, now: Date, timeZone: string): PortalBooking {
  const status = effectiveStatus(row, now);
  return {
    id: row.id,
    status,
    business: { slug: row.tenant.slug, name: row.tenant.name },
    branchName: row.branch.name,
    serviceName: row.serviceName,
    therapist: displayName(row.staff.teamAccount.name),
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    priceCents: row.priceCents,
    timeZone,
    holdExpiresAt: status === 'pending_payment' ? (row.holdExpiresAt?.toISOString() ?? null) : null,
    invoiceNumber: row.invoice?.number ?? '',
  };
}

/**
 * FSD 6.5, customer or guest: confirmed bookings only, before `starts_at − cut-off`, and
 * while reschedules are left. Null for any other status.
 */
export function reschedulingOf(
  row: {
    status: string;
    startsAt: Date;
    customerRescheduleCount: number;
    tenant: { cancellationCutoffHours: number; maxCustomerReschedules: number };
  },
  now: Date,
): { allowed: boolean; remaining: number; until: string; reason: RescheduleBlock | null } | null {
  if (row.status !== 'confirmed') return null;
  const until = new Date(row.startsAt.getTime() - row.tenant.cancellationCutoffHours * 3_600_000);
  const remaining = Math.max(0, row.tenant.maxCustomerReschedules - row.customerRescheduleCount);
  let reason: RescheduleBlock | null = null;
  if (now >= until) reason = 'CUTOFF_PASSED';
  else if (remaining === 0) reason = 'RESCHEDULE_LIMIT_REACHED';
  return { allowed: reason === null, remaining, until: until.toISOString(), reason };
}

export type RescheduleBlock = 'CUTOFF_PASSED' | 'RESCHEDULE_LIMIT_REACHED';

function toDetail(row: BookingRow, now: Date, timeZone: string): PortalBookingDetail {
  const booking = toPortalBooking(row, now, timeZone);
  const invoice = row.invoice!;
  const open = booking.status === 'pending_payment';
  const checkout = invoice.payments.find((p) => p.status === 'pending' && p.expiresAt > now);
  const rescheduling = reschedulingOf(row, now);
  return {
    ...booking,
    branchId: row.branchId,
    serviceId: row.serviceId,
    staffId: row.staffMembershipId,
    branchAddress: row.branch.address,
    notes: row.customerNotes,
    invoice: {
      number: invoice.number,
      status: invoice.status,
      amountCents: invoice.amountCents,
      issuedAt: invoice.issuedAt.toISOString(),
      paidAt: invoice.paidAt?.toISOString() ?? null,
    },
    payBy: open && checkout ? checkout.expiresAt.toISOString() : null,
    actions: { pay: open && !!checkout, cancel: open, reschedule: rescheduling?.allowed ?? false },
    rescheduling: rescheduling && { remaining: rescheduling.remaining, until: rescheduling.until },
  };
}

/** Portal views of bookings, in the order of `ids`. Runs in the bookings' tenant context. */
export async function portalBookings(
  tx: Tx,
  ids: string[],
  now: Date,
  timeZone: string,
): Promise<PortalBooking[]> {
  const rows = await loadRows(tx, ids);
  const byId = new Map(rows.map((row) => [row.id, toPortalBooking(row, now, timeZone)]));
  return ids.flatMap((id) => byId.get(id) ?? []);
}

export async function portalBooking(
  tx: Tx,
  id: string,
  now: Date,
  timeZone: string,
): Promise<PortalBooking> {
  const [booking] = await portalBookings(tx, [id], now, timeZone);
  if (!booking) throw new Error(`Booking ${id} not visible in this context`);
  return booking;
}

export async function portalBookingDetail(
  tx: Tx,
  id: string,
  now: Date,
  timeZone: string,
): Promise<{ detail: PortalBookingDetail; checkoutUrl: string | null }> {
  const [row] = await loadRows(tx, [id]);
  if (!row) throw new Error(`Booking ${id} not visible in this context`);
  const checkout = row.invoice?.payments.find((p) => p.status === 'pending' && p.expiresAt > now);
  // The Checkout URL stays server-side unless the customer asks to pay (`/checkout`).
  return { detail: toDetail(row, now, timeZone), checkoutUrl: checkout?.checkoutUrl ?? null };
}
