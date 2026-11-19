// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { describe, expect, it } from 'vitest';
import { retryDelayMs } from './outbox.js';
import { isKnownTemplate, renderEmail } from './templates.js';

describe('email templates', () => {
  it('puts the code in the subject, text and HTML of the login email', () => {
    const email = renderEmail('console.login_code', {
      name: 'Maya',
      code: '042137',
      expiresInMinutes: 10,
    });
    expect(email.subject).toContain('042137');
    expect(email.text).toContain('042137');
    expect(email.html).toContain('042137');
    expect(email.text).toContain('10 minutes');
  });

  it('escapes user-provided text in HTML', () => {
    const email = renderEmail('console.password_changed', { name: '<script>alert(1)</script>' });
    expect(email.html).not.toContain('<script>');
    expect(email.html).toContain('&lt;script&gt;');
  });

  it('names the business, role and branch in an invitation', () => {
    const email = renderEmail('console.invitation', {
      businessName: 'Lumen Wellness Studio',
      inviterName: 'Maya Reyes',
      role: 'staff',
      branchName: 'Downtown',
      acceptUrl: 'http://localhost:3001/invite/abc',
      expiresInDays: 7,
    });
    expect(email.subject).toBe('Maya Reyes invited you to Lumen Wellness Studio on Tempora');
    expect(email.text).toContain('staff at Downtown');
    expect(email.html).toContain('href="http://localhost:3001/invite/abc"');
  });

  it('shows the new and the previous time and therapist when a booking is changed', () => {
    const email = renderEmail('portal.booking_rescheduled', {
      name: 'Omar Haddad',
      businessName: 'Lumen <Wellness>',
      serviceName: 'Deep Tissue Massage',
      therapist: 'Daniel K.',
      when: 'Monday 23 November 2026 at 14:00',
      previousWhen: 'Monday 23 November 2026 at 10:00',
      previousTherapist: 'Ines H.',
      branchName: 'Downtown',
      address: '12 Harbor Street',
      bookingUrl: 'http://localhost:3000/manage/token',
    });
    expect(email.subject).toContain('Booking changed');
    expect(email.text).toContain('New: Monday 23 November 2026 at 14:00 with Daniel K.');
    expect(email.text).toContain('Was: Monday 23 November 2026 at 10:00 with Ines H.');
    expect(email.html).toContain('Lumen &lt;Wellness&gt;');
    expect(email.html).toContain('http://localhost:3000/manage/token');
  });

  it('says who refunds a paid booking cancelled by the business', () => {
    const base = {
      name: 'Omar Haddad',
      businessName: 'Lumen Wellness',
      serviceName: 'Deep Tissue Massage',
      therapist: 'Ines H.',
      when: 'Monday 23 November 2026 at 10:00',
      branchName: 'Downtown',
      address: null,
      bookingUrl: 'http://localhost:3000/manage/token',
    };
    const paid = renderEmail('portal.booking_cancelled', {
      ...base,
      reason: 'Therapist is ill',
      refundByBusiness: true,
    });
    expect(paid.text).toContain('Reason: Therapist is ill');
    expect(paid.text).toContain('Lumen Wellness will refund your payment directly.');
    const unpaid = renderEmail('portal.booking_cancelled', {
      ...base,
      reason: null,
      refundByBusiness: false,
    });
    expect(unpaid.text).toContain('Nothing was charged.');
    expect(unpaid.text).not.toContain('Reason:');
  });

  it('recognises only known templates', () => {
    expect(isKnownTemplate('console.password_reset')).toBe(true);
    expect(isKnownTemplate('console.unknown')).toBe(false);
    expect(isKnownTemplate('toString')).toBe(false);
  });
});

it('backs off exponentially between attempts', () => {
  expect([1, 2, 3, 4].map(retryDelayMs)).toEqual([30_000, 60_000, 120_000, 240_000]);
});
