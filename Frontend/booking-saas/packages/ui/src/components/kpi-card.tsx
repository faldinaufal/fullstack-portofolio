// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { cn } from '../lib/cn.js';
import { Icon, type IconName } from './icon.js';

export interface KpiCardProps {
  value: string;
  label: string;
  note?: string;
  icon: IconName;
  className?: string;
}

/** Key figure with a round icon, as in the dashboard designs. */
export function KpiCard({ value, label, note, icon, className }: Readonly<KpiCardProps>) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2.5 rounded-card border border-border bg-surface p-[18px]',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[26px] leading-tight font-extrabold text-primary-text">{value}</p>
          <p className="mt-0.5 text-sm font-bold">{label}</p>
        </div>
        <span className="flex size-[46px] shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground dark:bg-surface-muted dark:text-primary-text">
          <Icon name={icon} size={22} />
        </span>
      </div>
      {note && <p className="text-xs text-muted">{note}</p>}
    </div>
  );
}
