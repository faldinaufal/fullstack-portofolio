// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { describe, expect, it } from 'vitest';
import {
  moveActive,
  multipleSummary,
  selectAllState,
  toggleAll,
  toggleValue,
  typeahead,
} from './select.js';

const branches = [
  { value: 'dt', label: 'Downtown' },
  { value: 'hb', label: 'Harbor' },
  { value: 'hl', label: 'Hillside', disabled: true },
  { value: 'rv', label: 'Riverside' },
];

describe('select rules', () => {
  it('toggles a value and keeps the options order', () => {
    expect(toggleValue(['rv'], 'dt', branches)).toEqual(['dt', 'rv']);
    expect(toggleValue(['dt', 'rv'], 'dt', branches)).toEqual(['rv']);
  });

  it('select all: none, some, all; disabled options neither count nor change', () => {
    expect(selectAllState([], branches)).toBe('none');
    expect(selectAllState(['dt'], branches)).toBe('some');
    expect(selectAllState(['dt', 'hb', 'rv'], branches)).toBe('all');

    expect(toggleAll(['dt'], branches)).toEqual(['dt', 'hb', 'rv']);
    expect(toggleAll(['dt', 'hb', 'rv'], branches)).toEqual([]);
    // A disabled option that was selected stays selected.
    expect(toggleAll(['dt', 'hb', 'hl', 'rv'], branches)).toEqual(['hl']);
  });

  it('moves over disabled options and stops at the ends', () => {
    expect(moveActive(branches, 1, 1)).toBe(3);
    expect(moveActive(branches, 3, -1)).toBe(1);
    expect(moveActive(branches, 3, 1)).toBe(3);
    expect(moveActive(branches, -1, 1)).toBe(0);
  });

  it('type-ahead: by prefix, a repeated letter cycles, disabled skipped', () => {
    expect(typeahead(branches, 'r', -1)).toBe(3);
    expect(typeahead(branches, 'har', -1)).toBe(1);
    expect(typeahead(branches, 'h', 1)).toBe(1); // Hillside is disabled: back to Harbor
    expect(typeahead(branches, 'hh', 0)).toBe(1);
    expect(typeahead(branches, 'x', 0)).toBe(-1);
  });

  it('summarises a multiple choice', () => {
    const labels = { placeholder: 'Any branch', allLabel: 'All' };
    expect(multipleSummary([], branches, labels)).toBe('Any branch');
    expect(multipleSummary(['hb'], branches, labels)).toBe('Harbor');
    expect(multipleSummary(['dt', 'hb'], branches, labels)).toBe('2 selected');
    expect(multipleSummary(['dt', 'hb', 'hl', 'rv'], branches, labels)).toBe('All');
  });
});
