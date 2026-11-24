// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Select } from './select.js';

afterEach(cleanup);

const options = [
  { value: 'open', label: 'Unpaid' },
  { value: 'paid', label: 'Paid', icon: <svg data-testid="paid-icon" /> },
  { value: 'void', label: 'Void', disabled: true },
];

const combobox = (name = 'Status') => screen.getByRole('combobox', { name });
const key = (k: string) => fireEvent.keyDown(combobox(), { key: k });

describe('Select', () => {
  it('opens with the keyboard, moves past disabled options and chooses', () => {
    const onValueChange = vi.fn();
    render(
      <Select label="Status" options={options} placeholder="All" onValueChange={onValueChange} />,
    );
    expect(combobox()).toHaveProperty('textContent', 'All');
    expect(combobox().getAttribute('aria-expanded')).toBe('false');

    key('ArrowDown');
    expect(combobox().getAttribute('aria-expanded')).toBe('true');
    const active = () => document.getElementById(combobox().getAttribute('aria-activedescendant')!);
    expect(active()?.textContent).toBe('Unpaid');
    key('ArrowDown');
    key('ArrowDown'); // Void is disabled: stays on Paid
    expect(active()?.textContent).toBe('Paid');
    key('Enter');

    expect(onValueChange).toHaveBeenCalledWith('paid');
    expect(combobox().textContent).toBe('Paid');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('Escape closes without choosing; a click outside closes too', () => {
    const onValueChange = vi.fn();
    render(<Select label="Status" options={options} onValueChange={onValueChange} />);
    key('Enter');
    key('ArrowDown');
    key('Escape');
    expect(screen.queryByRole('listbox')).toBeNull();
    fireEvent.click(combobox());
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('starts on the first option without a placeholder, and submits with the form', () => {
    const { container } = render(
      <form>
        <Select label="Status" name="status" options={options} />
      </form>,
    );
    expect(combobox().textContent).toBe('Unpaid');
    const form = container.querySelector('form')!;
    expect(new FormData(form).get('status')).toBe('open');
    fireEvent.click(combobox());
    fireEvent.click(screen.getByRole('option', { name: 'Paid' }));
    expect(new FormData(form).get('status')).toBe('paid');
  });

  it('no checkbox and no icon by default; icons on the right when asked', () => {
    const { rerender } = render(<Select label="Status" options={options} />);
    fireEvent.click(combobox());
    expect(screen.queryByTestId('paid-icon')).toBeNull();
    expect(
      screen.getByRole('option', { name: 'Paid' }).querySelector('[aria-hidden] svg'),
    ).toBeNull();

    // The option's own icon, and one icon for the rest (any node: SVG, HTML, a component).
    rerender(<Select label="Status" options={options} icon={<b data-testid="fallback">★</b>} />);
    expect(screen.getByTestId('paid-icon')).toBeTruthy();
    expect(screen.getAllByTestId('fallback')).toHaveLength(2);
  });

  it('multiple with checkboxes and select all', () => {
    const onValueChange = vi.fn();
    const { container } = render(
      <form>
        <Select
          label="Status"
          name="status"
          multiple
          checkbox
          selectAll
          options={options}
          defaultValue={['open']}
          onValueChange={onValueChange}
        />
      </form>,
    );
    expect(combobox().textContent).toBe('Unpaid');
    fireEvent.click(combobox());
    expect(screen.getByRole('listbox').getAttribute('aria-multiselectable')).toBe('true');
    const all = screen.getByRole('option', { name: 'Select all' });
    expect(all.getAttribute('aria-checked')).toBe('mixed');

    fireEvent.click(all);
    expect(onValueChange).toHaveBeenLastCalledWith(['open', 'paid']);
    expect(all.getAttribute('aria-checked')).toBe('true');
    // Choosing keeps the list open in a multiple select.
    expect(screen.getByRole('listbox')).toBeTruthy();
    expect(new FormData(container.querySelector('form')!).getAll('status')).toEqual([
      'open',
      'paid',
    ]);

    fireEvent.click(screen.getByRole('option', { name: 'Paid' }));
    expect(onValueChange).toHaveBeenLastCalledWith(['open']);
    fireEvent.click(all);
    fireEvent.click(all);
    expect(onValueChange).toHaveBeenLastCalledWith([]);
    expect(combobox().textContent).toBe('None selected');
  });

  it('controlled: shows the value it is given', () => {
    const { rerender } = render(<Select label="Status" options={options} value="paid" />);
    expect(combobox().textContent).toBe('Paid');
    rerender(<Select label="Status" options={options} value="" placeholder="All" />);
    expect(combobox().textContent).toBe('All');
    // An option with value '' ("All statuses") is a choice like any other.
    rerender(
      <Select
        label="Status"
        options={[{ value: '', label: 'All statuses' }, ...options]}
        value=""
      />,
    );
    expect(combobox().textContent).toBe('All statuses');
  });

  it('type-ahead chooses on a closed single select', () => {
    const onValueChange = vi.fn();
    render(<Select label="Status" options={options} onValueChange={onValueChange} />);
    key('p');
    expect(onValueChange).toHaveBeenCalledWith('paid');
  });
});
