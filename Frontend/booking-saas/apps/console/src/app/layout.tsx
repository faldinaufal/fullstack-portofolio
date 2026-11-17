import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import type { ReactNode } from 'react';
import { AppProviders } from '@/composition/app-providers';
import { APP } from '@/ui/app-info';
import { AppHeader } from '@/ui/shell/app-header';
import './globals.css';

const sans = Inter({ subsets: ['latin'], variable: '--font-sans-family', display: 'swap' });

export const metadata: Metadata = {
  title: { default: `Tempora ${APP.name}`, template: `%s · Tempora ${APP.name}` },
  description: APP.description,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // next-themes sets the theme class before React hydrates.
    <html lang="en" className={sans.variable} suppressHydrationWarning>
      <body className="min-h-dvh font-sans antialiased">
        <AppProviders>
          <AppHeader />
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
