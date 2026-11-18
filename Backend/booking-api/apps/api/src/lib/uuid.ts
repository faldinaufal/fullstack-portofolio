// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { randomBytes } from 'node:crypto';

/**
 * UUID version 7 (RFC 9562): 48-bit Unix milliseconds followed by random bits. Same format
 * as the database defaults (FSD 4.1); used when an ID is needed before the row is inserted.
 */
export function uuidv7(now: Date = new Date()): string {
  const bytes = randomBytes(16);
  const ms = BigInt(now.getTime());
  for (let i = 0; i < 6; i += 1) {
    bytes[i] = Number((ms >> BigInt(8 * (5 - i))) & 0xffn);
  }
  bytes[6] = (bytes[6]! & 0x0f) | 0x70; // version 7
  bytes[8] = (bytes[8]! & 0x3f) | 0x80; // RFC 9562 variant
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
