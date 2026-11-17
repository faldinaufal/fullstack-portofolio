'use client';

import { ThemeProvider as NextThemesProvider, useTheme } from 'next-themes';
import { useSyncExternalStore, type ReactNode } from 'react';
import { Button } from './button.js';

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

export function ThemeToggle() {
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
      variant="ghost"
      size="icon"
      aria-label={label}
      title={label}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
    >
      <span aria-hidden="true">{isDark ? '☀' : '☾'}</span>
    </Button>
  );
}
