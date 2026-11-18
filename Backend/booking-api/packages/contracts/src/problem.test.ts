// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { describe, expect, it } from 'vitest';
import { ProblemDetailsSchema } from './problem.js';

describe('ProblemDetailsSchema', () => {
  it('accepts a problem with a known error code', () => {
    const result = ProblemDetailsSchema.safeParse({
      type: '/problems/slot-taken',
      title: 'Slot no longer available',
      status: 409,
      code: 'SLOT_TAKEN',
      requestId: 'req-1',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an unknown error code', () => {
    const result = ProblemDetailsSchema.safeParse({
      type: 'about:blank',
      title: 'Oops',
      status: 500,
      code: 'SOMETHING_ELSE',
      requestId: 'req-1',
    });
    expect(result.success).toBe(false);
  });
});
