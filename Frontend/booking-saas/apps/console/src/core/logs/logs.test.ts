// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { describe, expect, it } from 'vitest';
import { toAuditEntry, toEmailEntry } from './data/http-log-repository';
import { actionLabel, diffOf, templateLabel } from './domain/logs';

describe('audit log (FSD 2.2)', () => {
  it('lists only the fields that changed, nested ones by path', () => {
    expect(
      diffOf(
        { name: 'Lumen', bookingSettings: { minLeadHours: 4, maxAdvanceDays: 30 } },
        { name: 'Lumen Spa', bookingSettings: { minLeadHours: 4, maxAdvanceDays: 60 } },
      ),
    ).toEqual([
      { field: 'name', before: 'Lumen', after: 'Lumen Spa' },
      { field: 'bookingSettings.maxAdvanceDays', before: '30', after: '60' },
    ]);
  });

  it('a creation lists what it set; nothing changed lists nothing', () => {
    expect(diffOf(null, { role: 'staff' })).toEqual([
      { field: 'role', before: '—', after: 'staff' },
    ]);
    expect(diffOf({ status: 'confirmed' }, { status: 'confirmed' })).toEqual([]);
    expect(diffOf(null, null)).toEqual([]);
    expect(diffOf({ hours: [1] }, { hours: [1, 2] })).toEqual([
      { field: 'hours', before: '[1]', after: '[1,2]' },
    ]);
  });

  it('labels actions and templates, unknown ones as they are', () => {
    expect(actionLabel('support.viewed')).toBe('Tempora support viewed data');
    expect(actionLabel('something.new')).toBe('something.new');
    expect(templateLabel('portal.booking_reminder')).toBe('Reminder (24 h before)');
  });

  it('maps entries and their dates', () => {
    const entry = toAuditEntry({
      id: 'fa1d0000-0000-4000-8000-000000004217',
      at: '2026-11-23T15:00:00.000Z',
      actor: { type: 'team_member', label: 'Ines Halvorsen' },
      action: 'booking.cancelled',
      entityType: 'booking',
      entityId: 'fa1d0000-0000-4000-8000-000000000016',
      branch: null,
      before: null,
      after: null,
      reason: 'Therapist ill',
    });
    expect(entry.at).toEqual(new Date('2026-11-23T15:00:00Z'));
    const email = toEmailEntry({
      id: 'fa1d0000-0000-4000-8000-000000004217',
      to: 'omar@veloria.test',
      template: 'portal.booking_reminder',
      status: 'queued',
      attempts: 0,
      lastError: null,
      createdAt: '2026-11-23T15:00:00.000Z',
      sentAt: null,
      nextAttemptAt: '2026-11-24T15:00:00.000Z',
      bookingId: null,
    });
    expect(email.nextAttemptAt).toEqual(new Date('2026-11-24T15:00:00Z'));
    expect(email.sentAt).toBeNull();
  });
});
