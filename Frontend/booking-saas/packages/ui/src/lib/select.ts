// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

/** The rules of `Select`, kept apart from React so each one is unit-tested on its own. */

export interface SelectOptionRef {
  value: string;
  label: string;
  disabled?: boolean | undefined;
}

export type SelectAllState = 'none' | 'some' | 'all';

const enabled = (options: readonly SelectOptionRef[]) => options.filter((o) => !o.disabled);

/** Adds the value, or removes it if it is already selected. Keeps the options' order. */
export function toggleValue(
  values: readonly string[],
  value: string,
  options: readonly SelectOptionRef[],
): string[] {
  const next = values.includes(value) ? values.filter((v) => v !== value) : [...values, value];
  const order = new Map(options.map((o, i) => [o.value, i]));
  return next.sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
}

/** Whether every enabled option is selected, some of them, or none (the "Select all" box). */
export function selectAllState(
  values: readonly string[],
  options: readonly SelectOptionRef[],
): SelectAllState {
  const choices = enabled(options);
  const chosen = choices.filter((o) => values.includes(o.value)).length;
  if (chosen === 0) return 'none';
  return chosen === choices.length ? 'all' : 'some';
}

/**
 * "Select all" selects every enabled option; once all are selected it clears them. A disabled
 * option keeps its state either way: the user cannot change it.
 */
export function toggleAll(
  values: readonly string[],
  options: readonly SelectOptionRef[],
): string[] {
  const locked = options.filter((o) => o.disabled && values.includes(o.value)).map((o) => o.value);
  const all = selectAllState(values, options) === 'all';
  const picked = new Set([...locked, ...(all ? [] : enabled(options).map((o) => o.value))]);
  return options.filter((o) => picked.has(o.value)).map((o) => o.value);
}

/**
 * The next enabled option from `from` in direction `step` (1 down, -1 up), not wrapping, as
 * the ARIA listbox pattern does; `from` -1 with step 1 finds the first. Stays put at an end.
 */
export function moveActive(
  options: readonly SelectOptionRef[],
  from: number,
  step: 1 | -1,
): number {
  for (let i = from + step; i >= 0 && i < options.length; i += step) {
    if (!options[i]!.disabled) return i;
  }
  return from;
}

export const firstEnabled = (options: readonly SelectOptionRef[]) => moveActive(options, -1, 1);
export const lastEnabled = (options: readonly SelectOptionRef[]) =>
  moveActive(options, options.length, -1);

/**
 * Type-ahead: the first enabled option after `from` whose label starts with what was typed,
 * searching round from the top. Repeating one letter cycles through the options with it.
 */
export function typeahead(
  options: readonly SelectOptionRef[],
  query: string,
  from: number,
): number {
  const text = query.toLowerCase();
  const same = text.length > 1 && [...text].every((c) => c === text[0]);
  const needle = same ? text[0]! : text;
  const start = same || text.length === 1 ? from + 1 : Math.max(from, 0);
  for (let n = 0; n < options.length; n += 1) {
    const i = (start + n) % options.length;
    const option = options[i]!;
    if (!option.disabled && option.label.toLowerCase().startsWith(needle)) return i;
  }
  return -1;
}

/** What a multiple select's button says: nothing, the one choice, all, or how many. */
export function multipleSummary(
  values: readonly string[],
  options: readonly SelectOptionRef[],
  { placeholder, allLabel }: { placeholder: string; allLabel: string },
): string {
  const chosen = options.filter((o) => values.includes(o.value));
  if (chosen.length === 0) return placeholder;
  if (chosen.length === 1) return chosen[0]!.label;
  if (chosen.length === options.length) return allLabel;
  return `${chosen.length} selected`;
}
