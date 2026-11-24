// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { buttonVariants, Icon, type IconName } from '@tempora/ui';
import Link from 'next/link';
import { Suspense, type ReactNode } from 'react';
import { DirectorySearch, DirectorySearchForm } from './directory-search';
import { FeaturedBusinesses } from './featured-businesses';

/*
 * Portal home / directory (FSD 2.1). Layout from the "Explore Practices" design; the copy
 * only promises what the FSD does: payment at booking with a 30-minute hold (6.3), customer
 * reschedules within the business's cut-off and limit (6.5), no double bookings (6.2), the
 * service price as the invoice amount without tax lines (6.10), confirmation by email.
 */

const STEPS: { icon: IconName; title: string; text: string }[] = [
  {
    icon: 'user-search',
    title: 'Choose a service and therapist',
    text: 'Pick a branch, the service you want and the therapist you prefer. Only times that can really be booked are shown.',
  },
  {
    icon: 'timer',
    title: 'Hold your slot and pay',
    text: 'Your time slot is held for you for 30 minutes while you pay online. Nobody else can book it in that time.',
  },
  {
    icon: 'check-circle',
    title: 'Get your confirmation',
    text: 'As soon as the payment goes through, your booking is confirmed and the details arrive by email.',
  },
];

const PROMISES: { icon: IconName; title: string; text: string }[] = [
  {
    icon: 'receipt',
    title: 'Transparent pricing',
    text: 'You pay the service price shown when you book, in US dollars. Your invoice shows exactly that amount.',
  },
  {
    icon: 'calendar-edit',
    title: 'Self-service rescheduling',
    text: 'Plans change. Move a paid booking to another time yourself, up to the cut-off the business sets before your session.',
  },
  {
    icon: 'shield-check',
    title: 'No double bookings',
    text: 'A therapist can never be booked twice for the same time. Every booking is checked again the moment you make it.',
  },
];

function Eyebrow({ children }: Readonly<{ children: ReactNode }>) {
  return <p className="text-xs font-bold tracking-wider text-primary-text uppercase">{children}</p>;
}

export function HomeScreen() {
  return (
    <main>
      {/* Hero and search */}
      <section
        aria-labelledby="hero-title"
        className="bg-[radial-gradient(ellipse_70%_60%_at_50%_0%,var(--primary-container),transparent),linear-gradient(180deg,var(--primary-container),var(--background))] px-4 pt-16 pb-20 sm:px-6 sm:pt-20"
      >
        <div className="mx-auto flex max-w-[1200px] flex-col items-center gap-6 text-center">
          <p className="inline-flex items-center gap-2 rounded-full border border-border-subtle bg-surface px-3 py-1 text-[11px] font-bold tracking-wider text-primary-text uppercase">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-accent" />
            Simple, guaranteed appointments
          </p>
          <h1
            id="hero-title"
            className="max-w-[860px] text-[38px] leading-[1.06] font-semibold tracking-[-0.035em] text-balance sm:text-[56px] lg:text-[64px]"
          >
            Book wellness &amp; physiotherapy sessions near you.
          </h1>
          <p className="max-w-[580px] text-base leading-relaxed text-muted sm:text-lg">
            Browse studios and clinics, pick your therapist, and secure your exact time slot. Your
            booking is confirmed as soon as you pay.
          </p>
          {/* Reads the current search from the URL, which is only known in the browser. */}
          <Suspense fallback={<DirectorySearchForm current="" />}>
            <DirectorySearch />
          </Suspense>
        </div>
      </section>

      {/* Directory */}
      <section
        id="businesses"
        aria-labelledby="businesses-title"
        className="scroll-mt-20 px-4 pb-20 sm:px-6"
      >
        <div className="mx-auto flex max-w-[1200px] flex-col gap-8">
          <div className="flex flex-col gap-2">
            <p className="flex flex-wrap items-center gap-2 text-xs font-bold tracking-wider uppercase">
              <span className="text-primary-text">On Tempora</span>
              <span aria-hidden="true" className="size-1 rounded-full bg-border-strong" />
              <span className="text-muted normal-case tracking-normal">Live availability</span>
            </p>
            <h2
              id="businesses-title"
              className="text-[30px] leading-tight font-semibold tracking-tight sm:text-4xl"
            >
              Wellness studios &amp; clinics
            </h2>
            <p className="text-muted">
              Businesses taking bookings right now (fictional demo data).
            </p>
          </div>

          <Suspense>
            <FeaturedBusinesses />
          </Suspense>

          <div className="flex flex-col gap-4 rounded-panel border border-border-subtle bg-surface-muted p-5 sm:flex-row sm:items-center sm:p-6">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-container text-accent">
              <Icon name="lock" size={20} />
            </span>
            <div className="flex-1">
              <p className="font-bold">Your time slot is held while you pay</p>
              <p className="mt-1 text-sm text-muted">
                When you continue to payment, the slot is reserved for you for 30 minutes. Nobody
                else can book it in that time.
              </p>
            </div>
            <Link
              href="/#how"
              className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-primary-text"
            >
              How booking works <Icon name="arrow-right" size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* How booking works */}
      <section
        id="how"
        aria-labelledby="how-title"
        className="scroll-mt-20 bg-surface px-4 py-20 sm:px-6"
      >
        <div className="mx-auto flex max-w-[1200px] flex-col gap-12">
          <div className="mx-auto flex max-w-[620px] flex-col items-center gap-3 text-center">
            <Eyebrow>Clarity &amp; simplicity</Eyebrow>
            <h2
              id="how-title"
              className="text-[30px] leading-tight font-semibold tracking-tight sm:text-4xl"
            >
              How booking works
            </h2>
            <p className="leading-relaxed text-muted sm:text-lg">
              Three steps from choosing a session to a confirmed booking, with double bookings ruled
              out by design.
            </p>
          </div>
          <ol className="m-0 grid list-none gap-5 p-0 md:grid-cols-3">
            {STEPS.map((step, index) => (
              <li
                key={step.title}
                className="flex flex-col gap-3 rounded-panel bg-surface-muted p-6 sm:p-7"
              >
                <span className="mb-2 flex size-11 items-center justify-center rounded-card bg-surface text-accent shadow-[0_1px_2px_rgba(31,28,27,0.06)]">
                  <Icon name={step.icon} size={22} />
                </span>
                <p className="text-xs font-bold tracking-wider text-primary-text uppercase">
                  Step {String(index + 1).padStart(2, '0')}
                </p>
                <h3 className="text-lg font-bold tracking-tight">{step.title}</h3>
                <p className="text-[15px] leading-relaxed text-muted">{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Promises */}
      <section aria-labelledby="promise-title" className="px-4 pt-20 sm:px-6">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-8 rounded-panel bg-surface-sunken p-6 sm:p-10">
          <div className="flex max-w-[640px] flex-col gap-3">
            <Eyebrow>Our promise to customers</Eyebrow>
            <h2
              id="promise-title"
              className="text-[28px] leading-tight font-semibold tracking-tight sm:text-4xl"
            >
              Appointments designed around your peace of mind.
            </h2>
            <p className="leading-relaxed text-muted">
              Booking a session should feel as calm as the session itself. Here is what comes with
              every booking on Tempora.
            </p>
          </div>
          <ul className="m-0 grid list-none gap-4 p-0 md:grid-cols-3">
            {PROMISES.map((promise) => (
              <li
                key={promise.title}
                className="flex flex-col gap-3 rounded-card bg-surface p-6 shadow-[0_1px_2px_rgba(31,28,27,0.05)]"
              >
                <span className="flex size-10 items-center justify-center rounded-lg bg-primary-container text-on-primary-container">
                  <Icon name={promise.icon} size={20} />
                </span>
                <h3 className="text-base font-bold">{promise.title}</h3>
                <p className="text-sm leading-relaxed text-muted">{promise.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Call to action, with the way in for business owners (FSD: For businesses) */}
      <section aria-labelledby="cta-title" className="px-4 py-20 sm:px-6">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-8 rounded-panel bg-surface-high p-6 sm:p-10 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex max-w-[520px] flex-col gap-3">
            <h2
              id="cta-title"
              className="text-[28px] leading-tight font-semibold tracking-tight sm:text-4xl"
            >
              Ready for your next wellness session?
            </h2>
            <p className="leading-relaxed text-muted">
              Explore massage, physiotherapy and sports recovery at the studios and clinics on
              Tempora.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/#businesses" className={buttonVariants({ size: 'lg' })}>
              Browse businesses
            </Link>
            <Link
              href="/account/bookings"
              className={buttonVariants({ variant: 'secondary', size: 'lg' })}
            >
              My bookings
            </Link>
          </div>
        </div>

        <p
          id="for-business"
          className="mx-auto mt-6 max-w-[1200px] scroll-mt-20 text-center text-sm text-muted"
        >
          Run a studio or clinic?{' '}
          <a
            href={`${process.env.NEXT_PUBLIC_CONSOLE_URL ?? 'http://localhost:3001'}/signup`}
            className="font-semibold text-primary-text"
          >
            List your business on Tempora
          </a>
        </p>
      </section>
    </main>
  );
}
