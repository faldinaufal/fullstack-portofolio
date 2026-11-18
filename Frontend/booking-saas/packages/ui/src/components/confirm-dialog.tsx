// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Button } from './button.js';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  /** Red confirm button for destructive actions. */
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Asks before a destructive action (FSD 2: "destructive actions ask for confirmation").
 * Native modal <dialog>: focus stays inside, Escape cancels, and focus returns to the
 * button that opened it when it closes (FSD 8.4).
 */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
}: Readonly<ConfirmDialogProps>) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onCancel}
      className="m-auto w-[min(440px,calc(100vw-32px))] rounded-panel border-0 bg-surface p-0 text-foreground shadow-xl backdrop:bg-ink/55"
    >
      <div className="flex flex-col gap-4 p-6">
        <h2 id={titleId} className="text-lg font-extrabold">
          {title}
        </h2>
        <div className="text-sm leading-relaxed text-muted">{children}</div>
        <div className="mt-2 flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button variant={destructive ? 'danger' : 'primary'} onClick={onConfirm} disabled={busy}>
            {busy ? 'Working…' : confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
