// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

/** Support access (FSD 1.4, 3.10): the owner lets Tempora read the business's data for a while. */

export type SupportDuration = 1 | 24 | 72;
export const SUPPORT_DURATIONS: readonly SupportDuration[] = [1, 24, 72];

export interface SupportGrant {
  id: string;
  status: 'active' | 'expired' | 'revoked';
  startsAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
  grantedBy: string;
}

export interface SupportGrants {
  active: SupportGrant | null;
  items: SupportGrant[];
}

export interface SupportRepository {
  grants(): Promise<SupportGrants>;
  /** Replaces an active grant. */
  grant(durationHours: SupportDuration): Promise<SupportGrants>;
  revoke(id: string): Promise<SupportGrants>;
}

export const durationLabel = (hours: SupportDuration) =>
  hours === 1 ? '1 hour' : `${hours} hours`;

/** "Open for 2 h 15 min more", "Open for 40 min more"; null once it ended. */
export function timeLeft(grant: Pick<SupportGrant, 'expiresAt'>, now: Date): string | null {
  const minutes = Math.ceil((grant.expiresAt.getTime() - now.getTime()) / 60_000);
  if (minutes <= 0) return null;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}
