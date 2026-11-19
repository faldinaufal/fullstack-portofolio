// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { withDbContext, type PrismaClient, type Tx } from '@tempora/db';
import { generateToken, type TokenHasher } from '../../lib/tokens.js';
import { notFound } from '../console-auth/access.js';

const DAY = 24 * 60 * 60_000;

/** A booking link stays usable until 7 days after the session, for the receipt (FSD 4.3). */
export const BOOKING_LINK_AFTER_SESSION_MS = 7 * DAY;

/** Who is asking for a booking in the Portal: a logged-in customer, a booking link, or both. */
export interface BookingViewer {
  customerAccountId: string | null;
  /** Raw token from `Authorization: Guest <token>`. */
  guestToken: string | null;
}

export interface LocatedBooking {
  tenantId: string;
  bookingId: string;
  via: 'customer' | 'guest';
}

/**
 * Creates a booking link and returns the raw token, which is never stored (only its HMAC).
 * Runs in the booking's tenant context.
 */
export async function issueAccessToken(
  tx: Tx,
  hashToken: TokenHasher,
  booking: { id: string; tenantId: string; endsAt: Date },
): Promise<string> {
  const token = generateToken();
  await tx.bookingAccessToken.create({
    data: {
      tenantId: booking.tenantId,
      bookingId: booking.id,
      tokenHash: hashToken('booking-link', token),
      expiresAt: new Date(booking.endsAt.getTime() + BOOKING_LINK_AFTER_SESSION_MS),
    },
  });
  return token;
}

/**
 * Finds which business a booking belongs to, using only what row-level security lets this
 * viewer see (FSD 4.4): the customer policy for a logged-in customer, the booking-link policy
 * for a token. The caller then loads the booking in that tenant's context.
 *
 * Unknown, foreign, expired and revoked all answer the same `404`, so a guess reveals nothing.
 * With `bookingId` null (the `/manage/[token]` page) the token decides the booking.
 */
export async function locateBooking(
  prisma: PrismaClient,
  hashToken: TokenHasher,
  viewer: BookingViewer,
  bookingId: string | null,
  now: Date,
): Promise<LocatedBooking> {
  if (viewer.customerAccountId && bookingId) {
    const own = await withDbContext(prisma, { customerAccountId: viewer.customerAccountId }, (tx) =>
      tx.booking.findFirst({ where: { id: bookingId }, select: { tenantId: true } }),
    );
    if (own) return { tenantId: own.tenantId, bookingId, via: 'customer' };
  }
  if (viewer.guestToken) {
    const tokenHash = hashToken('booking-link', viewer.guestToken);
    const link = await withDbContext(prisma, { bookingTokenHash: tokenHash }, (tx) =>
      tx.bookingAccessToken.findUnique({ where: { tokenHash } }),
    );
    if (
      link &&
      !link.revokedAt &&
      link.expiresAt > now &&
      (bookingId === null || link.bookingId === bookingId)
    ) {
      return { tenantId: link.tenantId, bookingId: link.bookingId, via: 'guest' };
    }
  }
  throw notFound('Booking');
}

/** `Authorization: Guest <token>` → the token, or null. */
export function readGuestToken(header: string | undefined): string | null {
  const match = /^Guest\s+([A-Za-z0-9_-]{20,128})$/.exec(header ?? '');
  return match?.[1] ?? null;
}
