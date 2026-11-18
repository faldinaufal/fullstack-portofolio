// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '../lib/cn.js';

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  /** Accessible name of the drawer. */
  label: string;
  side?: 'left' | 'right';
  /** Wider panel for forms (440 px) instead of navigation (320 px). */
  wide?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * Off-canvas panel (mobile navigation, side forms), built on the native modal <dialog>: the browser
 * traps focus inside it, makes the page behind it inert and closes it on Escape.
 * It also closes on a backdrop click and after any link inside it is followed.
 */
export function Drawer({
  open,
  onClose,
  label,
  side = 'left',
  wide = false,
  className,
  children,
}: Readonly<DrawerProps>) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // Pointer convenience on top of the close button inside the panel (Escape is native).
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    function handleClick(event: MouseEvent) {
      const target = event.target as Element;
      // The backdrop counts as the <dialog> itself; the panel fills the rest of it.
      if (target === dialog || target.closest('a[href]')) onClose();
    }
    dialog.addEventListener('click', handleClick);
    return () => dialog.removeEventListener('click', handleClick);
  }, [onClose]);

  return (
    <dialog
      ref={ref}
      aria-label={label}
      onClose={onClose}
      className={cn(
        'fixed inset-y-0 m-0 h-dvh max-h-none max-w-none overflow-y-auto border-0 bg-transparent p-0 text-foreground backdrop:bg-ink/55',
        wide ? 'w-[min(440px,100vw)]' : 'w-[min(320px,86vw)]',
        side === 'left' ? 'right-auto left-0' : 'right-0 left-auto',
      )}
    >
      <div className={cn('min-h-full', className)}>{children}</div>
    </dialog>
  );
}
