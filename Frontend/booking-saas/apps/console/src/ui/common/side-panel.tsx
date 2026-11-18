// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import { Button, Drawer, Icon } from '@tempora/ui';
import type { ReactNode } from 'react';

/** Right-hand panel for short forms (new branch, invite, change role). */
export function SidePanel({
  open,
  title,
  onClose,
  children,
}: Readonly<{ open: boolean; title: string; onClose: () => void; children: ReactNode }>) {
  return (
    <Drawer
      open={open}
      onClose={onClose}
      label={title}
      side="right"
      wide
      className="flex flex-col gap-5 bg-surface p-6"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-extrabold">{title}</h2>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <Icon name="close" />
          <span className="sr-only">Close</span>
        </Button>
      </div>
      {children}
    </Drawer>
  );
}
