// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { MemberRole, Membership } from './auth';

export const PASSWORD_MIN_LENGTH = 12;

/**
 * Suggests a business address from its name: "Lumen Wellness Studio" → "lumen-wellness-studio".
 * Same character rules as the API (FSD 6.12): lowercase letters, digits, single hyphens, ≤ 40.
 */
export function slugFromBusinessName(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '');
}

/**
 * Client-side password check for instant feedback. The API checks the same rules again;
 * this only avoids a round trip for obvious mistakes.
 */
export function passwordProblem(password: string, email: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  const localPart = email.trim().toLowerCase().split('@')[0] ?? '';
  if (localPart.length >= 3 && password.toLowerCase().includes(localPart)) {
    return 'Must not contain your email address.';
  }
  return null;
}

/** Whole seconds until `target`, never negative. */
export function secondsUntil(target: Date, now: Date): number {
  return Math.max(0, Math.ceil((target.getTime() - now.getTime()) / 1000));
}

const ROLE_LABELS: Record<MemberRole, string> = {
  owner: 'Owner',
  manager: 'Manager',
  staff: 'Staff',
};

export function roleLabel(role: MemberRole): string {
  return ROLE_LABELS[role];
}

/** What part of the business a membership covers (FSD 1.1). */
export function scopeLabel(membership: Membership): string {
  if (membership.role === 'owner') return 'All branches';
  return membership.role === 'manager' ? 'Own branch' : 'Own schedule';
}
