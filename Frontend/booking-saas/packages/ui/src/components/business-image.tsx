// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { cn } from '../lib/cn.js';

/** "Lumen Wellness Studio" → "LW": the fallback when a business has no logo. */
export function businessInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join('');
}

/**
 * The brand gradient shown where a business has not uploaded an image (FSD 6.15). Shared so
 * the Console preview looks exactly like the Portal.
 */
export const BUSINESS_IMAGE_FALLBACK =
  'bg-[linear-gradient(135deg,var(--primary-container),var(--surface-muted))] text-on-primary-container';

/**
 * An image uploaded by a business owner, served from the storage origin (FSD 6.15). A plain
 * `<img>`: the files are already sized by the owner and live outside Next's image optimiser.
 */
export function UploadedImage({
  src,
  alt,
  className,
}: Readonly<{ src: string; alt: string; className?: string }>) {
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={cn('bg-surface-muted object-cover', className)}
    />
  );
}

/** The business logo, or its initials on the brand gradient. Size it with `className`. */
export function BusinessLogo({
  name,
  url,
  className,
}: Readonly<{ name: string; url: string | null; className?: string }>) {
  if (url) {
    return (
      <UploadedImage
        src={url}
        alt={`${name} logo`}
        className={cn('shrink-0 rounded-card border border-border-subtle', className)}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex shrink-0 items-center justify-center rounded-card font-semibold',
        BUSINESS_IMAGE_FALLBACK,
        className,
      )}
    >
      {businessInitials(name)}
    </span>
  );
}

/**
 * A therapist's photo (FSD 6.15), or their initials on the brand gradient. The name is always
 * printed next to it, so the picture is decorative (`alt=""`). Size it with `className`.
 */
export function TherapistPhoto({
  name,
  url,
  className,
}: Readonly<{ name: string; url: string | null; className?: string }>) {
  if (url) {
    return <UploadedImage src={url} alt="" className={cn('shrink-0 rounded-card', className)} />;
  }
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex shrink-0 items-center justify-center rounded-card font-semibold',
        BUSINESS_IMAGE_FALLBACK,
        className,
      )}
    >
      {businessInitials(name.replace(/\./g, ''))}
    </span>
  );
}
