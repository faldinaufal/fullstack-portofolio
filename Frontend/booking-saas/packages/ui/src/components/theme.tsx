// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import { ThemeProvider as NextThemesProvider, useTheme } from 'next-themes';
import { useSyncExternalStore, type ReactNode } from 'react';
import { Button } from './button.js';
import { Icon } from './icon.js';

const subscribeToNothing = () => () => {};

/** Light/dark/system theme, stored per browser; adds the `dark` class on <html>. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}

export interface ThemeToggleProps {
  /** `surface`: bordered round button (dashboards); `brand`: white icon on a blue band. */
  appearance?: 'surface' | 'brand';
  className?: string;
}

export function ThemeToggle({ appearance = 'surface', className }: Readonly<ThemeToggleProps>) {
  const { resolvedTheme, setTheme } = useTheme();
  // The theme is only known in the browser: false while rendering on the server and
  // during hydration, true afterwards. Avoids a hydration mismatch on the icon.
  const isBrowser = useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );

  const isDark = isBrowser && resolvedTheme === 'dark';
  const label = isDark ? 'Switch to light mode' : 'Switch to dark mode';

  return (
    <Button
      variant={appearance === 'brand' ? 'inverse-outline' : 'secondary'}
      size="icon"
      aria-label={label}
      title={label}
      className={className}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
    >
      <Icon name={isDark ? 'sun' : 'moon'} size={18} />
    </Button>
  );
}
