// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { describe, expect, it } from 'vitest';
import { detectImageType } from './image-type.js';

const bytes = (...values: (number | string)[]) =>
  new Uint8Array(
    values.flatMap((v) => (typeof v === 'string' ? [...v].map((c) => c.charCodeAt(0)) : [v])),
  );

describe('detectImageType (FSD 6.15)', () => {
  it('recognises PNG, JPEG and WebP by their first bytes', () => {
    expect(detectImageType(bytes(0x89, 'PNG', 0x0d, 0x0a, 0x1a, 0x0a))).toBe('image/png');
    expect(detectImageType(bytes(0xff, 0xd8, 0xff, 0xdb))).toBe('image/jpeg');
    expect(detectImageType(bytes('RIFF', 0, 0, 0, 0, 'WEBP'))).toBe('image/webp');
  });

  it('rejects everything else, including SVG, GIF, other RIFF files and short files', () => {
    expect(detectImageType(bytes('<svg xmlns="http://www.w3.org/2000/svg">'))).toBeNull();
    expect(detectImageType(bytes('GIF89a'))).toBeNull();
    expect(detectImageType(bytes('RIFF', 0, 0, 0, 0, 'WAVE'))).toBeNull();
    expect(detectImageType(bytes(0x89, 'PN'))).toBeNull();
    expect(detectImageType(new Uint8Array())).toBeNull();
  });
});
