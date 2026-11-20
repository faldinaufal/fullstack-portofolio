// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

/** The audit log and the email log (FSD 2.2 `/audit`, `/emails`). */

export interface AuditEntry {
  id: string;
  at: Date;
  actor: { type: 'team_member' | 'platform_admin' | 'customer' | 'system'; label: string };
  action: string;
  entityType: string;
  entityId: string | null;
  branch: { id: string; name: string } | null;
  before: unknown;
  after: unknown;
  reason: string | null;
}

export interface AuditFilters {
  actor?: string | undefined;
  /** An action, or a group such as `booking.` */
  action?: string | undefined;
  from?: string | undefined;
  to?: string | undefined;
}

export interface AuditPage {
  items: AuditEntry[];
  nextCursor: string | null;
  timeZone: string;
}

export type EmailStatus = 'queued' | 'sent' | 'failed' | 'skipped';

export interface EmailEntry {
  id: string;
  to: string;
  template: string;
  status: EmailStatus;
  attempts: number;
  lastError: string | null;
  createdAt: Date;
  sentAt: Date | null;
  nextAttemptAt: Date | null;
  bookingId: string | null;
}

export interface EmailFilters {
  status?: EmailStatus | undefined;
  q?: string | undefined;
  page: number;
}

export interface EmailPage {
  items: EmailEntry[];
  page: number;
  pageSize: number;
  total: number;
  timeZone: string;
}

export interface LogRepository {
  audit(filters: AuditFilters, cursor: string | null): Promise<AuditPage>;
  auditExportUrl(filters: AuditFilters): string;
  emails(filters: EmailFilters): Promise<EmailPage>;
}

/** Action groups for the filter, by the entity they concern. */
export const ACTION_GROUPS: { value: string; label: string }[] = [
  { value: 'booking.', label: 'Bookings' },
  { value: 'payment.', label: 'Payments' },
  { value: 'branch.', label: 'Branches' },
  { value: 'service.', label: 'Services' },
  { value: 'membership.', label: 'Team' },
  { value: 'invitation.', label: 'Invitations' },
  { value: 'time_off.', label: 'Time off' },
  { value: 'tenant.', label: 'Business' },
  { value: 'support.', label: 'Support access' },
  { value: 'export.', label: 'Exports' },
];

const ACTIONS: Record<string, string> = {
  'booking.created': 'Booking held',
  'booking.confirmed': 'Booking confirmed',
  'booking.rescheduled': 'Booking rescheduled',
  'booking.reassigned': 'Booking reassigned',
  'booking.cancelled': 'Booking cancelled',
  'booking.expired': 'Hold expired',
  'booking.completed': 'Marked completed',
  'booking.no_show': 'Marked no-show',
  'payment.needs_attention': 'Payment needs attention',
  'branch.created': 'Branch created',
  'branch.updated': 'Branch updated',
  'branch.archived': 'Branch archived',
  'branch.opening_hours_replaced': 'Opening hours changed',
  'branch.closure_added': 'Closure added',
  'branch.closure_removed': 'Closure removed',
  'service.created': 'Service created',
  'service.updated': 'Service updated',
  'service.archived': 'Service archived',
  'membership.updated': 'Member changed',
  'membership.deactivated': 'Member deactivated',
  'membership.reactivated': 'Member reactivated',
  'membership.services_replaced': 'Services of a therapist changed',
  'membership.working_hours_replaced': 'Working hours changed',
  'invitation.created': 'Invitation sent',
  'invitation.resent': 'Invitation resent',
  'invitation.revoked': 'Invitation revoked',
  'invitation.accepted': 'Invitation accepted',
  'time_off.created': 'Time off added',
  'time_off.removed': 'Time off removed',
  'tenant.created': 'Business created',
  'tenant.updated': 'Business settings changed',
  'tenant.suspended': 'Business suspended by Tempora',
  'tenant.reactivated': 'Business reactivated by Tempora',
  'support.granted': 'Support access granted',
  'support.revoked': 'Support access revoked',
  'support.expired': 'Support access expired',
  'support.viewed': 'Tempora support viewed data',
  'export.created': 'CSV exported',
};

/** "Booking cancelled"; an unknown action is shown as it is. */
export const actionLabel = (action: string) => ACTIONS[action] ?? action;

export interface Change {
  field: string;
  before: string;
  after: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const show = (value: unknown): string => {
  if (value === undefined || value === null) return '—';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
};

/**
 * The fields that differ between `before` and `after`, nested fields as `a.b`. A side that is
 * missing counts as empty, so a creation lists every field it set.
 */
export function diffOf(before: unknown, after: unknown, prefix = ''): Change[] {
  if (!isRecord(before) && !isRecord(after)) {
    return show(before) === show(after)
      ? []
      : [{ field: prefix || 'value', before: show(before), after: show(after) }];
  }
  const left = isRecord(before) ? before : {};
  const right = isRecord(after) ? after : {};
  const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])];
  return keys.flatMap((key) => {
    const field = prefix ? `${prefix}.${key}` : key;
    const [a, b] = [left[key], right[key]];
    if (isRecord(a) || isRecord(b)) return diffOf(a, b, field);
    return show(a) === show(b) ? [] : [{ field, before: show(a), after: show(b) }];
  });
}

const TEMPLATES: Record<string, string> = {
  'portal.booking_confirmed': 'Booking confirmation',
  'portal.booking_reminder': 'Reminder (24 h before)',
  'portal.booking_rescheduled': 'Booking moved',
  'portal.booking_cancelled': 'Booking cancelled',
  'console.invitation': 'Team invitation',
  'console.payment_needs_attention': 'Payment needs attention',
  'console.tenant_suspended': 'Business suspended',
  'console.tenant_reactivated': 'Business reactivated',
};

export const templateLabel = (template: string) => TEMPLATES[template] ?? template;
