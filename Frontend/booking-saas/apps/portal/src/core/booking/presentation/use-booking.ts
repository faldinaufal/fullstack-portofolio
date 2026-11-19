// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import { useQuery } from '@tanstack/react-query';
import type { BranchPage, BusinessPage, PublicService, SlotQuery } from '../domain/booking';
import { bookableDays, summarizeHours, therapistsFor } from '../domain/booking';
import { useDependencies } from '../../shared/presentation/dependencies';

export const formatPrice = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);

export const formatDuration = (minutes: number) =>
  minutes < 60
    ? `${minutes} min`
    : `${Math.floor(minutes / 60)} h${minutes % 60 ? ` ${minutes % 60} min` : ''}`;

export interface ServiceView extends PublicService {
  price: string;
  duration: string;
}

export const toServiceView = (service: PublicService): ServiceView => ({
  ...service,
  price: formatPrice(service.priceCents),
  duration: formatDuration(service.durationMinutes),
});

/** "Mon 23 Nov": a calendar date (not an instant), so it is formatted in UTC. */
const dayLabel = (date: string) =>
  new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`));

export function useBusinessPage(slug: string) {
  const { booking } = useDependencies();
  return useQuery({
    queryKey: ['business', slug],
    queryFn: () => booking.getBusiness(slug),
    retry: false,
    select: (business: BusinessPage) => ({
      ...business,
      services: business.services.map(toServiceView),
      branches: business.branches.map((branch) => ({
        ...branch,
        hours: summarizeHours(branch.openingHours),
      })),
    }),
  });
}

export function useBranchPage(slug: string, branchId: string | undefined) {
  const { booking } = useDependencies();
  return useQuery({
    queryKey: ['business', slug, 'branch', branchId],
    queryFn: () => booking.getBranch(slug, branchId!),
    enabled: !!branchId,
    retry: false,
    select: (branch: BranchPage) => ({
      ...branch,
      hours: summarizeHours(branch.openingHours),
      services: branch.services.map(toServiceView),
      therapistsFor: (serviceId: string) => therapistsFor(branch, serviceId),
    }),
  });
}

/** Days of the booking horizon, with labels; closed days are kept but disabled. */
export function toBookableDays(
  branch: Pick<BranchPage, 'openingHours' | 'closures'> | undefined,
  business: Pick<BusinessPage, 'maxAdvanceDays' | 'timeZone'> | undefined,
) {
  if (!branch || !business) return [];
  return bookableDays(branch, business.maxAdvanceDays, business.timeZone, new Date()).map(
    (day) => ({
      ...day,
      label: dayLabel(day.date),
    }),
  );
}

/** Free start times; times are shown in the business's time zone, not the visitor's. */
export function useSlots(slug: string, query: SlotQuery | null, timeZone: string | undefined) {
  const { booking } = useDependencies();
  return useQuery({
    queryKey: ['slots', slug, query],
    queryFn: () => booking.getSlots(slug, query!),
    enabled: !!query && !!timeZone,
    select: (slots) => {
      const time = new Intl.DateTimeFormat('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone,
      });
      return slots.map((slot) => ({
        key: slot.startsAt.toISOString(),
        startsAt: slot.startsAt,
        label: time.format(slot.startsAt),
        until: time.format(slot.endsAt),
      }));
    },
  });
}
