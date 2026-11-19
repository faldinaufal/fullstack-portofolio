// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { describe, expect, it } from 'vitest';
import { BOM, csvAmount, csvCell, csvDateTime, csvLine, csvStream, CSV_MAX_ROWS } from './csv.js';

async function read(stream: NodeJS.ReadableStream) {
  let text = '';
  for await (const chunk of stream) text += String(chunk);
  return text;
}

describe('CSV cells (RFC 4180)', () => {
  it('quotes commas, quotes and line breaks', () => {
    expect(csvCell('Lumen, Downtown')).toBe('"Lumen, Downtown"');
    expect(csvCell('Say "hi"')).toBe('"Say ""hi"""');
    expect(csvCell('line\nbreak')).toBe('"line\nbreak"');
    expect(csvCell(null)).toBe('');
    expect(csvCell(4217)).toBe('4217');
    expect(csvLine(['a', 'b'])).toBe('a,b\r\n');
  });

  it('neutralises formulas from customer data (CSV injection)', () => {
    expect(csvCell('=HYPERLINK("http://evil.test")')).toBe('"\'=HYPERLINK(""http://evil.test"")"');
    expect(csvCell('+1 555 0147')).toBe("'+1 555 0147");
    expect(csvCell('-2')).toBe("'-2");
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(csvCell('Ines Halvorsen')).toBe('Ines Halvorsen');
    // Numbers we write ourselves are not text from customers.
    expect(csvCell(-5)).toBe('-5');
  });

  it('formats times on the platform clock and amounts as decimals', () => {
    expect(csvDateTime(new Date('2026-11-23T15:00:00Z'), 'America/New_York')).toBe(
      '2026-11-23 10:00',
    );
    expect(csvDateTime(null, 'America/New_York')).toBe('');
    expect(csvAmount(4217)).toBe('42.17');
  });
});

describe('CSV stream', () => {
  it('writes the header and every page until a short one, with a UTF-8 mark', async () => {
    const pages = [Array(500).fill('x'), ['y', 'z']];
    const text = await read(
      csvStream(
        ['Name'],
        async (page) => pages[page - 1] ?? [],
        (row) => [row],
      ),
    );
    const lines = text.split('\r\n');
    expect(lines[0]).toBe(`${BOM}Name`);
    expect(lines).toHaveLength(1 + 502 + 1); // trailing newline
  });

  it(`stops at ${CSV_MAX_ROWS} rows`, async () => {
    const text = await read(
      csvStream(
        ['N'],
        async (_page, size) => Array(size).fill('r'),
        (row) => [row],
      ),
    );
    expect(text.split('\r\n').length - 2).toBe(CSV_MAX_ROWS);
  });
});
