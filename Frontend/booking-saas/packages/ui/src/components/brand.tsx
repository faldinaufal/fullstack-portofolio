// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { cn } from '../lib/cn.js';

/*
 * The Tempora logo (packages/ui/brand/logo-tempora.png), cut into pieces that every app serves
 * from `public/brand/`: the lotus mark, the wordmark (grey, plus a light copy for dark mode)
 * and the stacked logo.
 */
const MARK_RATIO = 359 / 229;
const WORDMARK_RATIO = 827 / 183;

/** The lotus mark. `size` is its height in pixels. */
export function TemporaMark({
  size = 24,
  className,
}: Readonly<{ size?: number; className?: string }>) {
  return (
    <img
      src="/brand/tempora-mark.png"
      alt=""
      aria-hidden="true"
      width={Math.round(size * MARK_RATIO)}
      height={size}
      className={cn('shrink-0 select-none', className)}
      draggable={false}
    />
  );
}

/** The wordmark alone: grey, or the light copy in dark mode. `height` in pixels. */
export function TemporaWordmark({
  height = 24,
  className,
}: Readonly<{ height?: number; className?: string }>) {
  const width = Math.round(height * WORDMARK_RATIO);
  return (
    <span className={cn('inline-flex', className)}>
      <img
        src="/brand/tempora-wordmark.png"
        alt=""
        width={width}
        height={height}
        className="select-none dark:hidden"
        draggable={false}
      />
      <img
        src="/brand/tempora-wordmark-dark.png"
        alt=""
        width={width}
        height={height}
        className="hidden select-none dark:block"
        draggable={false}
      />
    </span>
  );
}

/**
 * Horizontal lockup: lotus mark beside the wordmark. Named "Tempora" for screen readers,
 * so a link around it needs no other text.
 */
export function TemporaLogo({
  height = 32,
  className,
}: Readonly<{ height?: number; className?: string }>) {
  return (
    <span
      role="img"
      aria-label="Tempora"
      className={cn('inline-flex items-center gap-2', className)}
    >
      <TemporaMark size={height} />
      <TemporaWordmark height={Math.round(height * 0.72)} />
    </span>
  );
}
