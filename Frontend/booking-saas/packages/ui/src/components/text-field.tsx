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
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          'h-12 rounded-xl border bg-surface px-3.5 text-[15px] text-foreground placeholder:text-muted',
          error ? 'border-danger' : 'border-border',
        )}
        {...props}
      />
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
