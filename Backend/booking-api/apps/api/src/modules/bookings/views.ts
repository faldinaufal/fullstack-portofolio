// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { PortalBooking, PortalBookingDetail } from '@tempora/contracts';
import type { Tx } from '@tempora/db';
import { displayName } from '../public/service.js';

const INCLUDE = {
  tenant: { select: { slug: true, name: true } },
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
    business: row.tenant,
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

function toDetail(row: BookingRow, now: Date, timeZone: string): PortalBookingDetail {
  const booking = toPortalBooking(row, now, timeZone);
  const invoice = row.invoice!;
  const open = booking.status === 'pending_payment';
  const checkout = invoice.payments.find((p) => p.status === 'pending' && p.expiresAt > now);
  return {
    ...booking,
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
    actions: { pay: open && !!checkout, cancel: open },
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
