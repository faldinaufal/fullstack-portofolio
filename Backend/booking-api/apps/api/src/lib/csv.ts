// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { Readable } from 'node:stream';

/**
 * CSV exports (FSD 5.1): RFC 4180 quoting, plus protection against CSV injection. A cell that
 * starts with `=`, `+`, `-`, `@`, tab or carriage return would run as a formula when the file
 * is opened in a spreadsheet, and the data comes from customers (a name like `=HYPERLINK(...)`),
 * so such cells get a leading `'`.
 */

export type CsvValue = string | number | boolean | null | undefined;

const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(value: CsvValue): string {
  if (value === null || value === undefined) return '';
  let text = String(value);
  if (typeof value === 'string' && FORMULA_START.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export const csvLine = (values: CsvValue[]) => `${values.map(csvCell).join(',')}\r\n`;

/** Byte-order mark, so spreadsheet apps read accented names as UTF-8. */
export const BOM = String.fromCharCode(0xfeff);

/** At most this many rows per export; the table's filters narrow anything bigger. */
export const CSV_MAX_ROWS = 10_000;
const BATCH = 500;

/**
 * Streams a CSV: the header, then rows fetched page by page, so a large export never sits in
 * memory as a whole. `fetchPage` returns the rows of one page (1-based), empty when done.
 */
export function csvStream<T>(
  header: string[],
  fetchPage: (page: number, pageSize: number) => Promise<T[]>,
  toValues: (row: T) => CsvValue[],
): Readable {
  async function* lines() {
    yield `${BOM}${csvLine(header)}`;
    let written = 0;
    for (let page = 1; written < CSV_MAX_ROWS; page += 1) {
      const rows = await fetchPage(page, BATCH);
      for (const row of rows.slice(0, CSV_MAX_ROWS - written)) yield csvLine(toValues(row));
      written += rows.length;
      if (rows.length < BATCH) break;
    }
  }
  return Readable.from(lines());
}

/** `2026-11-23 10:00` on the platform's wall clock. */
export function csvDateTime(instant: Date | null, timeZone: string): string {
  if (!instant) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')} ${part('hour')}:${part('minute')}`;
}

/** Integer cents as a plain decimal, e.g. `42.17`. */
export const csvAmount = (cents: number) => (cents / 100).toFixed(2);
