// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '../lib/cn.js';
import {
  firstEnabled,
  lastEnabled,
  moveActive,
  multipleSummary,
  selectAllState,
  toggleAll,
  toggleValue,
  typeahead,
  type SelectAllState,
} from '../lib/select.js';
import { Icon } from './icon.js';

export interface SelectOption {
  value: string;
  label: string;
  /** This option's icon on the right; shown when the select's `icon` prop is set. */
  icon?: ReactNode;
  disabled?: boolean;
}

/**
 * The icon on the right of each option. `false` (default): none. `true`: each option's own
 * `icon`. Any node (SVG, HTML, an icon library component): that icon for every option, unless
 * the option has its own. A function: computed per option.
 */
export type SelectIcon =
  boolean | ReactNode | ((option: SelectOption, state: { selected: boolean }) => ReactNode);

interface SelectBaseProps {
  label: string;
  /** Keeps the label for screen readers only (compact toolbars). */
  hideLabel?: boolean;
  hint?: ReactNode;
  error?: string | undefined;
  options: readonly SelectOption[];
  /** Shown while nothing is selected. A single select without one starts on its first option. */
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  /** Submits the value with the form, like a native `<select name>`. */
  name?: string;
  id?: string;
  /** A checkbox on the left of each option. Default `false`. */
  checkbox?: boolean;
  /** An icon on the right of each option. Default `false`; see `SelectIcon`. */
  icon?: SelectIcon;
  className?: string;
  labelClassName?: string;
  triggerClassName?: string;
}

export interface SingleSelectProps extends SelectBaseProps {
  multiple?: false;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  selectAll?: never;
}

export interface MultipleSelectProps extends SelectBaseProps {
  multiple: true;
  value?: readonly string[];
  defaultValue?: readonly string[];
  onValueChange?: (values: string[]) => void;
  /** Adds a "Select all" option at the top (`true`), or one with this label. */
  selectAll?: boolean | string;
}

export type SelectProps = SingleSelectProps | MultipleSelectProps;

/** The "Select all" row: before the options, index -1 in the active-option state. */
const ALL = -1;
/** No option active (the list is closed). */
const NONE = -2;

function Checkbox({ state }: Readonly<{ state: SelectAllState | boolean }>) {
  const checked = state === true || state === 'all';
  const mixed = state === 'some';
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex size-[18px] shrink-0 items-center justify-center rounded-[5px] border',
        checked || mixed
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border-strong bg-surface',
      )}
    >
      {checked && <Icon name="check" size={13} strokeWidth={3} />}
      {mixed && <span className="h-0.5 w-2 rounded-full bg-current" />}
    </span>
  );
}

function iconOf(icon: SelectIcon | undefined, option: SelectOption, selected: boolean): ReactNode {
  if (!icon) return null;
  if (typeof icon === 'function') return icon(option, { selected });
  if (icon === true) return option.icon ?? null;
  return option.icon ?? icon;
}

/**
 * A select with a styled list (FSD 8.4), single or multiple, with optional checkboxes on the
 * left, icons on the right and a "Select all" option.
 *
 * It follows the WAI-ARIA "select-only combobox" pattern: focus stays on the button, the
 * active option is announced through `aria-activedescendant`, and the keyboard works like a
 * native select (arrows, Home/End, Enter or Space, Escape, typing a label's first letters).
 * The list renders inside the component, not in a portal, so it also works inside modal
 * dialogs (which make the rest of the page inert). With `name`, hidden inputs carry the value
 * into the form, as a native select would.
 */
export function Select(props: Readonly<SelectProps>) {
  const {
    label,
    hideLabel = false,
    hint,
    error,
    options,
    placeholder,
    disabled = false,
    required = false,
    name,
    id,
    checkbox = false,
    icon = false,
    className,
    labelClassName,
    triggerClassName,
  } = props;
  const multiple = props.multiple === true;
  const selectAll = props.multiple === true ? props.selectAll : undefined;
  const allLabel = typeof selectAll === 'string' ? selectAll : 'Select all';

  const autoId = useId();
  const triggerId = id ?? `${autoId}-select`;
  const labelId = `${autoId}-label`;
  const listId = `${autoId}-list`;
  const hintId = hint ? `${autoId}-hint` : undefined;
  const errorId = error ? `${autoId}-error` : undefined;
  const optionId = (index: number) => `${autoId}-option-${index === ALL ? 'all' : index}`;

  // Controlled when `value` is given, otherwise it keeps its own state (form fields).
  const initial = (): string[] => {
    if (props.multiple === true) return [...(props.defaultValue ?? [])];
    if (props.defaultValue !== undefined) return [props.defaultValue];
    if (placeholder !== undefined) return [];
    const first = options[firstEnabled(options)];
    return first ? [first.value] : [];
  };
  const [own, setOwn] = useState<string[]>(initial);
  const controlled = props.value !== undefined;
  let values: readonly string[] = own;
  if (props.multiple === true && props.value !== undefined) values = props.value;
  // An empty value still selects an option with value '' ("All statuses"), else none.
  if (props.multiple !== true && props.value !== undefined) values = [props.value];

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(NONE);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const typed = useRef({ text: '', at: 0 });

  function commit(next: string[]) {
    if (!controlled) setOwn(next);
    if (props.multiple === true) props.onValueChange?.(next);
    else props.onValueChange?.(next[0] ?? '');
  }

  const hasAll = multiple && Boolean(selectAll);
  const allState = selectAllState(values, options);

  function openList(at?: number) {
    if (disabled) return;
    const selected = options.findIndex((o) => values.includes(o.value) && !o.disabled);
    setActive(at ?? (selected >= 0 ? selected : hasAll ? ALL : firstEnabled(options)));
    setOpen(true);
  }

  function close() {
    setOpen(false);
    setActive(NONE);
  }

  function choose(index: number) {
    if (index === ALL) {
      commit(toggleAll(values, options));
      return;
    }
    const option = options[index];
    if (!option || option.disabled) return;
    if (multiple) {
      commit(toggleValue(values, option.value, options));
    } else {
      if (!values.includes(option.value)) commit([option.value]);
      close();
    }
  }

  // Close when the pointer goes down outside the field.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close();
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  // Keep the active option in view while moving through a long list.
  useEffect(() => {
    if (!open || active === NONE) return;
    const element = document.getElementById(`${autoId}-option-${active === ALL ? 'all' : active}`);
    element?.scrollIntoView?.({ block: 'nearest' });
  }, [open, active, autoId]);

  function step(from: number, direction: 1 | -1): number {
    if (from === ALL) return direction === 1 ? firstEnabled(options) : ALL;
    const next = moveActive(options, from, direction);
    if (direction === -1 && next === from && hasAll) return ALL;
    return next;
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    const key = event.key;
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(key)) {
        event.preventDefault();
        openList(key === 'ArrowUp' ? lastEnabled(options) : undefined);
        return;
      }
    } else if (key === 'ArrowDown' || key === 'ArrowUp') {
      event.preventDefault();
      setActive((current) => step(current, key === 'ArrowDown' ? 1 : -1));
      return;
    } else if (key === 'Home' || key === 'PageUp') {
      event.preventDefault();
      setActive(hasAll ? ALL : firstEnabled(options));
      return;
    } else if (key === 'End' || key === 'PageDown') {
      event.preventDefault();
      setActive(lastEnabled(options));
      return;
    } else if (key === 'Enter' || key === ' ') {
      event.preventDefault();
      choose(active);
      return;
    } else if (key === 'Escape') {
      event.preventDefault();
      close();
      return;
    } else if (key === 'Tab') {
      close();
      return;
    }

    // Type-ahead: letters typed within half a second form one search.
    if (key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const now = event.timeStamp;
      typed.current = {
        text: now - typed.current.at < 500 ? typed.current.text + key : key,
        at: now,
      };
      const found = typeahead(options, typed.current.text, open ? active : -1);
      if (found < 0) return;
      if (open) setActive(found);
      else if (!multiple) choose(found);
    }
  }

  let summary: string;
  if (multiple) {
    summary = multipleSummary(values, options, {
      placeholder: placeholder ?? 'None selected',
      allLabel: options.length > 1 ? 'All' : (options[0]?.label ?? ''),
    });
  } else {
    summary = options.find((o) => o.value === values[0])?.label ?? placeholder ?? '';
  }
  const empty = values.length === 0 || !options.some((o) => values.includes(o.value));
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  const rowClass = (index: number, isDisabled = false) =>
    cn(
      'flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-[15px]',
      index === active && 'bg-surface-muted',
      isDisabled && 'cursor-not-allowed opacity-50',
    );

  return (
    <div ref={rootRef} className={cn('relative flex flex-col gap-1.5', className)}>
      <label
        id={labelId}
        htmlFor={triggerId}
        className={cn('text-sm font-semibold', hideLabel && 'sr-only', labelClassName)}
      >
        {label}
      </label>
      <button
        type="button"
        id={triggerId}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-labelledby={labelId}
        aria-activedescendant={open && active !== NONE ? optionId(active) : undefined}
        aria-invalid={error ? true : undefined}
        aria-required={required || undefined}
        aria-describedby={describedBy}
        disabled={disabled}
        onClick={() => (open ? close() : openList())}
        onKeyDown={onKeyDown}
        className={cn(
          'flex h-12 w-full items-center gap-2 rounded-xl border bg-surface px-3 text-left text-[15px] text-foreground',
          'disabled:cursor-not-allowed disabled:opacity-60',
          error ? 'border-danger' : 'border-border-strong',
          triggerClassName,
        )}
      >
        <span className={cn('min-w-0 flex-1 truncate', empty && 'text-muted')}>{summary}</span>
        <Icon
          name="chevron-down"
          size={18}
          className={cn('shrink-0 text-muted transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-labelledby={labelId}
          aria-multiselectable={multiple || undefined}
          tabIndex={-1}
          // Keeps focus on the button while choosing with the pointer.
          onMouseDown={(event) => event.preventDefault()}
          className="absolute top-full right-0 left-0 z-50 mt-1 max-h-72 overflow-auto rounded-xl border border-border bg-surface p-1 text-foreground shadow-[0_14px_34px_rgba(31,28,27,0.16)]"
        >
          {hasAll && (
            <li
              id={optionId(ALL)}
              role="option"
              aria-selected={allState === 'all'}
              aria-checked={allState === 'some' ? 'mixed' : allState === 'all'}
              onClick={() => choose(ALL)}
              onMouseEnter={() => setActive(ALL)}
              className={cn(rowClass(ALL), 'font-semibold')}
            >
              {checkbox && <Checkbox state={allState} />}
              <span className="flex-1">{allLabel}</span>
            </li>
          )}
          {options.map((option, index) => {
            const selected = values.includes(option.value);
            const trailing = iconOf(icon, option, selected);
            return (
              <li
                key={option.value}
                id={optionId(index)}
                role="option"
                aria-selected={selected}
                aria-disabled={option.disabled || undefined}
                onClick={() => choose(index)}
                onMouseEnter={() => !option.disabled && setActive(index)}
                className={cn(
                  rowClass(index, option.disabled),
                  selected && !checkbox && 'font-semibold text-primary-text',
                )}
              >
                {checkbox && <Checkbox state={selected} />}
                <span className="min-w-0 flex-1">{option.label}</span>
                {trailing && (
                  <span aria-hidden="true" className="flex shrink-0 items-center text-muted">
                    {trailing}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {name &&
        (values.length > 0 ? values : multiple ? [] : ['']).map((value) => (
          <input key={value || 'empty'} type="hidden" name={name} value={value} />
        ))}
      {hint && (
        <p id={hintId} className="text-[13px] text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-[13px] font-semibold text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
