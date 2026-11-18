import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import type { ReactNode } from 'react';
import { AppProviders } from '@/composition/app-providers';
import { APP } from '@/ui/app-info';
import { SiteFooter } from '@/ui/shell/site-footer';
import { SiteHeader } from '@/ui/shell/site-header';
import './globals.css';

const sans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans-family',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: `Tempora ${APP.name}`, template: `%s · Tempora ${APP.name}` },
  description: APP.description,
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    // next-themes sets the theme class before React hydrates.
    <html lang="en" className={sans.variable} suppressHydrationWarning>
      <body className="min-h-dvh font-sans antialiased">
        <AppProviders>
          <SiteHeader />
          {children}
          <SiteFooter />
        </AppProviders>
      </body>
    </html>
  );
}
