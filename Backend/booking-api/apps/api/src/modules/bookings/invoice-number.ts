// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

/**
 * Invoice numbering (FSD 6.10): `<prefix>-<year>-<6-digit sequence>`, e.g. `LUM-2026-000123`.
 * The sequence comes from a locked counter row per tenant and year (see the repository); these
 * helpers only build and validate the text, so they are unit-tested on their own.
 */

/** "lumen" → "LUM", "h2o" → "HOX": three letters of the slug, padded with X. Same rule as the migration. */
export function invoicePrefixBase(slug: string): string {
  return `${slug.replace(/[^a-z]/g, '')}xxx`.slice(0, 3).toUpperCase();
}

/** The base prefix, or base + the smallest free number when it is taken ("LUM2"). */
export function nextInvoicePrefix(base: string, taken: string[]): string {
  const used = new Set(taken);
  if (!used.has(base)) return base;
  for (let n = 2; n <= 999; n += 1) {
    if (!used.has(`${base}${n}`)) return `${base}${n}`;
  }
  throw new Error(`No free invoice prefix for ${base}`);
}

export function formatInvoiceNumber(prefix: string, year: number, sequence: number): string {
  return `${prefix}-${year}-${String(sequence).padStart(6, '0')}`;
}
