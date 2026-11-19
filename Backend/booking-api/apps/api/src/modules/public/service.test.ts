// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { describe, expect, it } from 'vitest';
import { displayName, escapeLike } from './service.js';

describe('public helpers', () => {
  it('shows therapists by first name and last initial only', () => {
    expect(displayName('Ines Halvorsen')).toBe('Ines H.');
    expect(displayName('  Daniel  Kim  ')).toBe('Daniel K.');
    expect(displayName('Omar')).toBe('Omar');
  });

  it('escapes LIKE wildcards so visitor input is matched literally', () => {
    expect(escapeLike('100%')).toBe('100\\%');
    expect(escapeLike('a_b\\c')).toBe('a\\_b\\\\c');
  });
});
