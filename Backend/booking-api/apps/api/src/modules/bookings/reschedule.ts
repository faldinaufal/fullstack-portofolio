// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type {
  Availability,
  PortalBookingDetail,
  RescheduleRequest,
  RescheduleSlotsQuery,
} from '@tempora/contracts';
import type { Tx } from '@tempora/db';
import { AppError } from '../../lib/app-error.js';
import { recordAudit } from '../../lib/audit.js';
import { availableSlots, calendarDateOf, slotProblem } from '../availability/engine.js';
import { loadAvailabilityInput } from '../availability/load.js';
import type { BookingViewer, LocatedBooking } from './access.js';
import { queueRescheduled, type BookingEmailContext } from './emails.js';
import { expireStaleHolds, isOverlapViolation, lockTherapists, slotError } from './rules.js';
import { reschedulingOf } from './views.js';

const MINUTE = 60_000;

export interface RescheduleDeps {
  inTenant: <T>(tenantId: string, work: (tx: Tx) => Promise<T>) => Promise<T>;
  locate: (viewer: BookingViewer, bookingId: string) => Promise<LocatedBooking>;
  detailOf: (found: LocatedBooking) => Promise<PortalBookingDetail>;
  emails: BookingEmailContext;
  timeZone: string;
  now: () => Date;
}

const BLOCKED = {
  CUTOFF_PASSED: {
    title: 'Too late to reschedule',
    detail: 'This booking can no longer be moved online. Please contact the business.',
  },
  RESCHEDULE_LIMIT_REACHED: {
    title: 'No reschedules left',
    detail: 'This booking has been moved as often as allowed. Please contact the business.',
  },
} as const;

/**
 * The booking being moved, checked against FSD 6.5 for customers and guests. Runs in the
 * booking's tenant context; throws the specific reason when moving is not allowed.
 */
async function movable(tx: Tx, bookingId: string, now: Date) {
  const booking = await tx.booking.findUniqueOrThrow({
    where: { id: bookingId },
    include: {
      tenant: true,
      tenantCustomer: true,
    },
  });
  const rules = reschedulingOf(booking, now);
  if (!rules) {
    throw new AppError({
      status: 409,
      code: 'NOT_RESCHEDULABLE',
      title: 'Booking cannot be moved',
      detail: 'Only confirmed bookings can be rescheduled.',
    });
  }
  if (rules.reason) {
    throw new AppError({ status: 409, code: rules.reason, ...BLOCKED[rules.reason] });
  }
  return booking;
}

/** FSD 6.5: customers and guests move their own confirmed bookings. */
export function createReschedule({
  inTenant,
  locate,
  detailOf,
  emails,
  timeZone,
  now,
}: RescheduleDeps) {
  /** Same rules as booking (FSD 6.2), with the booking's own duration and buffer. */
  const settingsOf = (tenant: { minLeadHours: number; maxAdvanceDays: number }) => ({
    minLeadHours: tenant.minLeadHours,
    maxAdvanceDays: tenant.maxAdvanceDays,
  });

  return {
    /** Free times to move to: the booking's own time does not count as taken. */
    async rescheduleSlots(
      viewer: BookingViewer,
      bookingId: string,
      query: RescheduleSlotsQuery,
    ): Promise<Availability> {
      const found = await locate(viewer, bookingId);
      return inTenant(found.tenantId, async (tx) => {
        const booking = await movable(tx, bookingId, now());
        const { input } = await loadAvailabilityInput(
          tx,
          {
            branchId: booking.branchId,
            serviceId: booking.serviceId,
            staffId: query.staffId,
            date: query.date,
            excludeBookingId: booking.id,
          },
          { timeZone, now: now(), settings: settingsOf(booking.tenant) },
        );
        const slots = availableSlots({
          ...input,
          service: {
            durationMinutes: booking.durationMinutes,
            bufferMinutes: booking.bufferMinutes,
          },
        }).filter(
          (slot) =>
            !(
              slot.startsAt.getTime() === booking.startsAt.getTime() &&
              query.staffId === booking.staffMembershipId
            ),
        );
        return {
          date: query.date,
          timeZone,
          slots: slots.map((slot) => ({
            startsAt: slot.startsAt.toISOString(),
            endsAt: slot.endsAt.toISOString(),
          })),
        };
      });
    },

    /**
     * Moves the booking in place (same invoice and payment): both therapists locked in ID
     * order, every rule re-checked, the exclusion constraint as the last line of defence,
     * one customer reschedule counted, "booking moved" email and a reminder for the new time.
     */
    async reschedule(
      viewer: BookingViewer,
      bookingId: string,
      input: RescheduleRequest,
      ip: string,
    ): Promise<PortalBookingDetail> {
      const found = await locate(viewer, bookingId);
      const startsAt = new Date(input.startsAt);
      try {
        await inTenant(found.tenantId, async (tx) => {
          const current = await tx.booking.findUniqueOrThrow({ where: { id: bookingId } });
          const staffId = input.staffId ?? current.staffMembershipId;
          await lockTherapists(tx, [current.staffMembershipId, staffId]);
          // Re-read under the lock: a concurrent reschedule may have moved it meanwhile.
          const booking = await movable(tx, bookingId, now());
          if (
            booking.startsAt.getTime() === startsAt.getTime() &&
            booking.staffMembershipId === staffId
          ) {
            throw new AppError({
              status: 400,
              code: 'VALIDATION_FAILED',
              title: 'Same time',
              detail: 'Choose a different time or therapist.',
              errors: [{ path: 'startsAt', message: 'This is the current time of the booking.' }],
            });
          }
          await expireStaleHolds(tx, staffId, now());

          const { input: slotInput } = await loadAvailabilityInput(
            tx,
            {
              branchId: booking.branchId,
              serviceId: booking.serviceId,
              staffId,
              date: calendarDateOf(startsAt, timeZone),
              excludeBookingId: booking.id,
            },
            { timeZone, now: now(), settings: settingsOf(booking.tenant) },
          );
          const problem = slotProblem(
            {
              ...slotInput,
              service: {
                durationMinutes: booking.durationMinutes,
                bufferMinutes: booking.bufferMinutes,
              },
            },
            startsAt,
          );
          if (problem) throw slotError(problem);

          const endsAt = new Date(startsAt.getTime() + booking.durationMinutes * MINUTE);
          await tx.booking.update({
            where: { id: booking.id },
            data: {
              startsAt,
              endsAt,
              blockedUntil: new Date(endsAt.getTime() + booking.bufferMinutes * MINUTE),
              staffMembershipId: staffId,
              customerRescheduleCount: { increment: 1 },
              version: { increment: 1 },
            },
          });
          const byCustomer = found.via === 'customer' ? viewer.customerAccountId : null;
          await recordAudit(
            tx,
            {
              type: 'customer',
              id: byCustomer,
              label: byCustomer
                ? booking.tenantCustomer.name
                : `${booking.tenantCustomer.name} (guest)`,
              ip,
            },
            {
              tenantId: booking.tenantId,
              branchId: booking.branchId,
              action: 'booking.rescheduled',
              entityType: 'booking',
              entityId: booking.id,
              before: { startsAt: booking.startsAt, staffId: booking.staffMembershipId },
              after: { startsAt, staffId },
            },
          );
          await queueRescheduled(tx, booking.id, booking.startsAt, emails, now());
        });
      } catch (error) {
        if (isOverlapViolation(error)) throw slotError('SLOT_TAKEN');
        throw error;
      }
      return detailOf(found);
    },
  };
}
