// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { InputHTMLAttributes } from 'react';
import { cn } from '../lib/cn.js';
import { Icon } from './icon.js';

export interface SearchFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** Accessible name; also used as the placeholder when none is given. */
  label: string;
}

/** Rounded search input used in the dashboard top bars. */
export function SearchField({
  label,
  className,
  placeholder,
  ...props
}: Readonly<SearchFieldProps>) {
  return (
    <label
      className={cn(
        'flex h-11 min-w-0 flex-[0_1_320px] items-center gap-2.5 rounded-full bg-surface-muted px-4 text-muted',
        className,
      )}
    >
      <Icon name="search" size={18} />
      <span className="sr-only">{label}</span>
      <input
        type="search"
        placeholder={placeholder ?? label}
        className="min-w-0 flex-1 border-0 bg-transparent text-sm text-foreground outline-offset-4 placeholder:text-muted"
        {...props}
      />
    </label>
  );
}
