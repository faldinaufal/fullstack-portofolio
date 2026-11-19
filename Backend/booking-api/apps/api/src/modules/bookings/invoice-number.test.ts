// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { describe, expect, it } from 'vitest';
import { formatInvoiceNumber, invoicePrefixBase, nextInvoicePrefix } from './invoice-number.js';

describe('invoice numbers (FSD 6.10)', () => {
  it('derives three letters from the slug, padded with X', () => {
    expect(invoicePrefixBase('lumen')).toBe('LUM');
    expect(invoicePrefixBase('h2o')).toBe('HOX');
    expect(invoicePrefixBase('a-1')).toBe('AXX');
    expect(invoicePrefixBase('veloria-spa')).toBe('VEL');
  });

  it('adds the smallest free number when the prefix is taken', () => {
    expect(nextInvoicePrefix('LUM', [])).toBe('LUM');
    expect(nextInvoicePrefix('LUM', ['LUM'])).toBe('LUM2');
    expect(nextInvoicePrefix('LUM', ['LUM', 'LUM2', 'LUM4'])).toBe('LUM3');
  });

  it('formats prefix, year and a six-digit sequence', () => {
    expect(formatInvoiceNumber('LUM', 2026, 1)).toBe('LUM-2026-000001');
    expect(formatInvoiceNumber('LUM2', 2027, 4217)).toBe('LUM2-2027-004217');
  });
});
