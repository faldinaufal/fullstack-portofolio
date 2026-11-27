// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { describe, expect, it } from 'vitest';
import { loginCode, textParts } from './demo-inbox';

describe('loginCode', () => {
  it('reads the code of a login code email only', () => {
    expect(loginCode({ subject: '421700 is your Tempora Console code' })).toBe('421700');
    expect(loginCode({ subject: '421700 is your Tempora Platform Admin code' })).toBe('421700');
    expect(loginCode({ subject: 'Invoice 421700 is your receipt' })).toBeNull();
    expect(loginCode({ subject: 'Your booking is confirmed' })).toBeNull();
  });
});

describe('textParts', () => {
  it('links this site and its subdomains, and keeps other links as text', () => {
    const text =
      'Reset: https://tempora.test/reset?t=1. Console: https://console.tempora.test/x\nElse: https://evil.test/a';
    expect(textParts(text, 'tempora.test')).toEqual([
      { kind: 'text', text: 'Reset: ' },
      {
        kind: 'link',
        text: 'https://tempora.test/reset?t=1',
        href: 'https://tempora.test/reset?t=1',
      },
      { kind: 'text', text: '. Console: ' },
      {
        kind: 'link',
        text: 'https://console.tempora.test/x',
        href: 'https://console.tempora.test/x',
      },
      { kind: 'text', text: '\nElse: https://evil.test/a' },
    ]);
  });

  it('does not treat a look-alike host as a subdomain', () => {
    expect(textParts('https://eviltempora.test/a', 'tempora.test')).toEqual([
      { kind: 'text', text: 'https://eviltempora.test/a' },
    ]);
  });
});
