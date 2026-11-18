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

  it('recognises only known templates', () => {
    expect(isKnownTemplate('console.password_reset')).toBe(true);
    expect(isKnownTemplate('console.unknown')).toBe(false);
    expect(isKnownTemplate('toString')).toBe(false);
  });
});

it('backs off exponentially between attempts', () => {
  expect([1, 2, 3, 4].map(retryDelayMs)).toEqual([30_000, 60_000, 120_000, 240_000]);
});
