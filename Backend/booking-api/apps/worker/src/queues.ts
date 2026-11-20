// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

/**
 * Every queue the worker knows about. Names are `<area>.<action>` so logs and the
 * pg-boss tables group naturally. Feature queues (emails, hold expiry, reminders)
 * are added together with their features.
 */
export const QUEUES = {
  heartbeat: 'system.heartbeat',
  expireHolds: 'bookings.expire-holds',
  autoComplete: 'bookings.auto-complete',
  supportExpiry: 'support.record-expiry',
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];
