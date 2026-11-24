// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../lib/cn.js';

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  /** Short help shown under the field. */
  hint?: ReactNode;
  /** Error shown under the field; marks the input invalid for assistive technology. */
  error?: string | undefined;
  /** Extra element on the right of the label row, e.g. a "Forgot password?" link. */
  labelAction?: ReactNode;
  /** Decorative icon inside the field, on the left. */
  leading?: ReactNode;
  /** Element inside the field, on the right: an icon or a small button. */
  trailing?: ReactNode;
}

/**
 * Labelled input with hint and inline error (FSD 8.4: labels, errors linked to fields).
 * The error is connected with `aria-describedby`, so screen readers read it with the field.
 */
export function TextField({
  label,
  hint,
  error,
  labelAction,
  leading,
  trailing,
  id,
  className,
  ...props
}: Readonly<TextFieldProps>) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={inputId} className="text-sm font-semibold">
          {label}
        </label>
        {labelAction}
      </div>
      <div className="relative flex items-center">
        {leading && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-3.5 flex text-muted"
          >
            {leading}
          </span>
        )}
        <input
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            'h-12 w-full rounded-lg border bg-surface px-3.5 text-[15px] text-foreground placeholder:text-muted',
            error ? 'border-danger' : 'border-border-strong',
            leading && 'pl-11',
            trailing && 'pr-12',
          )}
          {...props}
        />
        {trailing && <span className="absolute right-1.5 flex">{trailing}</span>}
      </div>
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
