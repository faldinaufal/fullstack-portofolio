// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { describe, expect, it } from 'vitest';
import { toApiStatusViewModel } from './api-status.view-model';

const checkedAt = new Date('2026-11-18T09:30:00.000Z');

describe('toApiStatusViewModel', () => {
  it('shows a neutral checking state before the first answer', () => {
    expect(toApiStatusViewModel(undefined)).toMatchObject({ tone: 'neutral' });
  });

  it('shows the version when online', () => {
    expect(toApiStatusViewModel({ state: 'online', version: '1.4.0', checkedAt })).toEqual({
      label: 'API online',
      tone: 'success',
      detail: 'Connected to Tempora API 1.4.0.',
    });
  });

  it('shows a danger state when offline', () => {
    expect(toApiStatusViewModel({ state: 'offline', version: null, checkedAt })).toMatchObject({
      label: 'API offline',
      tone: 'danger',
    });
  });
});
