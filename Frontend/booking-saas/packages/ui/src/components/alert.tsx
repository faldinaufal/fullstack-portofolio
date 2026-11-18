// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { ReactNode } from 'react';
import { cn } from '../lib/cn.js';
import { Icon, type IconName } from './icon.js';

export type AlertTone = 'info' | 'success' | 'danger';

const TONES: Record<AlertTone, { box: string; icon: IconName }> = {
  info: { box: 'bg-info-soft text-info', icon: 'pulse' },
  success: { box: 'bg-success-soft text-success', icon: 'check' },
  danger: { box: 'bg-danger-soft text-danger', icon: 'shield' },
};

export interface AlertProps {
  tone?: AlertTone;
  title?: string;
  children: ReactNode;
  className?: string;
}

/**
 * Inline message. Errors use `role="alert"` so screen readers announce them immediately;
 * other tones use `role="status"`, which waits for a pause.
 */
export function Alert({ tone = 'info', title, children, className }: Readonly<AlertProps>) {
  const { box, icon } = TONES[tone];
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn('flex gap-3 rounded-xl px-4 py-3 text-sm', box, className)}
    >
      <Icon name={icon} size={18} className="mt-0.5 shrink-0" />
      <div className="flex flex-col gap-0.5">
        {title && <p className="font-bold">{title}</p>}
        <div className="text-foreground">{children}</div>
      </div>
    </div>
  );
}
