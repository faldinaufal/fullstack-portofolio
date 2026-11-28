// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { describe, expect, it } from 'vitest';
import { emailLabel, loginCode, matchesSearch, paragraphs, textParts } from './demo-inbox';

describe('loginCode', () => {
  it('reads the code of a login code email only', () => {
    expect(loginCode({ subject: '421700 is your Tempora Console code' })).toBe('421700');
    expect(loginCode({ subject: '421700 is your Tempora Platform Admin code' })).toBe('421700');
    expect(loginCode({ subject: 'Invoice 421700 is your receipt' })).toBeNull();
    expect(loginCode({ subject: 'Your booking is confirmed' })).toBeNull();
  });
});

describe('textParts', () => {
  const hosts = ['tempora.test', 'console-tempora.test'];

  it("links Tempora's own hosts and keeps every other link as text", () => {
    const text =
      'Reset: https://tempora.test/reset?t=1. Console: https://console-tempora.test/x\nElse: https://evil.test/a';
    expect(textParts(text, hosts)).toEqual([
      { kind: 'text', text: 'Reset: ' },
      {
        kind: 'link',
        text: 'https://tempora.test/reset?t=1',
        href: 'https://tempora.test/reset?t=1',
      },
      { kind: 'text', text: '. Console: ' },
      {
        kind: 'link',
        text: 'https://console-tempora.test/x',
        href: 'https://console-tempora.test/x',
      },
      { kind: 'text', text: '\nElse: https://evil.test/a' },
    ]);
  });

  it('matches host names exactly: no look-alikes, no subdomains', () => {
    for (const url of ['https://eviltempora.test/a', 'https://x.tempora.test/a']) {
      expect(textParts(url, hosts)).toEqual([{ kind: 'text', text: url }]);
    }
  });
});

describe('emailLabel', () => {
  it('groups templates, and shows an unknown one as a plain email', () => {
    expect(emailLabel('admin.login_code')).toMatchObject({ kind: 'code', label: 'Login code' });
    expect(emailLabel('portal.booking_rescheduled')).toMatchObject({ kind: 'booking' });
    expect(emailLabel('portal.something_new')).toEqual({
      kind: 'other',
      label: 'Email',
      tone: 'neutral',
    });
  });
});

describe('matchesSearch', () => {
  const email = {
    id: '1',
    to: 'owner@demo.test',
    template: 'console.login_code',
    subject: '421700 is your Tempora Console code',
    text: 'Hi Ines,\n\nYour login code is 421700.',
    receivedAt: new Date(),
  };
  it('finds by recipient, subject, code or template, ignoring case', () => {
    for (const q of ['OWNER@', 'console code', '421700', 'login_code', '  ']) {
      expect(matchesSearch(email, q)).toBe(true);
    }
    expect(matchesSearch(email, 'manager')).toBe(false);
  });
});

describe('paragraphs', () => {
  it('splits on blank lines and keeps the lines of a paragraph', () => {
    expect(paragraphs('Hi Ines,\n\nMassage with Mira\nMon 10:00\n\n\nDetails: x')).toEqual([
      ['Hi Ines,'],
      ['Massage with Mira', 'Mon 10:00'],
      ['Details: x'],
    ]);
  });
});
