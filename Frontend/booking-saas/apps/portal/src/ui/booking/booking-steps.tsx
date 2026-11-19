// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { Icon } from '@tempora/ui';
import Link from 'next/link';

const STEPS = ['Service and therapist', 'Time', 'Details and payment'];

/** Back link and progress for the three booking steps (FSD 2.1). */
export function BookingSteps({
  businessName,
  slug,
  current,
}: Readonly<{ businessName: string; slug: string; current: number }>) {
  return (
    <div className="flex flex-col gap-4">
      <Link
        href={`/${slug}`}
        className="flex items-center gap-1.5 text-sm font-semibold text-primary-text"
      >
        <Icon name="chevron-left" size={16} /> {businessName}
      </Link>
      <h1 className="text-[32px] leading-tight font-extrabold">Book a session</h1>
      <ol className="m-0 flex list-none flex-wrap gap-2 p-0" aria-label="Booking steps">
        {STEPS.map((label, index) => (
          <li
            key={label}
            aria-current={index === current ? 'step' : undefined}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${
              index === current
                ? 'bg-primary text-primary-foreground'
                : 'bg-surface-muted text-muted'
            }`}
          >
            {index + 1}. {label}
          </li>
        ))}
      </ol>
    </div>
  );
}
