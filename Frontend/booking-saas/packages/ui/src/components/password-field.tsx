// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import { useState } from 'react';
import { Icon } from './icon.js';
import { TextField, type TextFieldProps } from './text-field.js';

/** Password input with a button that shows or hides what was typed. */
export function PasswordField(props: Readonly<Omit<TextFieldProps, 'type' | 'trailing'>>) {
  const [visible, setVisible] = useState(false);
  const label = visible ? 'Hide password' : 'Show password';
  return (
    <TextField
      {...props}
      type={visible ? 'text' : 'password'}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((shown) => !shown)}
          aria-label={label}
          aria-pressed={visible}
          title={label}
          className="flex size-10 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-muted hover:text-foreground"
        >
          <Icon name={visible ? 'eye-off' : 'eye'} size={20} />
        </button>
      }
    />
  );
}
