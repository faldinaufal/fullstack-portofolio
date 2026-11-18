// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Badge } from './badge.js';

describe('Badge', () => {
  it('shows its text so status is not conveyed by colour alone', () => {
    render(<Badge tone="success">API online</Badge>);
    const badge = screen.getByText('API online');
    expect(badge.className).toContain('text-success');
  });
});
