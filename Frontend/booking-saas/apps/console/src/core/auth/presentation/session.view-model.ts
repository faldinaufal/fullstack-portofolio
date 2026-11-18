// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { ConsoleSession, MemberRole } from '../domain/auth';
import { roleLabel, scopeLabel } from '../domain/auth-rules';

export interface SessionViewModel {
  /** Active membership: what the screens use to show or hide actions. */
  membershipId: string;
  role: MemberRole;
  branchId: string | null;
  accountName: string;
  /** "Maya R." */
  shortName: string;
  initials: string;
  email: string;
  roleLabel: string;
  tenantName: string;
  /** "Owner · All branches" */
  subtitle: string;
  businesses: { id: string; name: string; initial: string; active: boolean }[];
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts.at(-1)?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

function shortNameOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts.at(-1)?.[0]}.` : (parts[0] ?? '');
}

export function toSessionViewModel(session: ConsoleSession): SessionViewModel {
  const active = session.activeMembership;
  return {
    membershipId: active.id,
    role: active.role,
    branchId: active.branchId,
    accountName: session.account.name,
    shortName: shortNameOf(session.account.name),
    initials: initialsOf(session.account.name),
    email: session.account.email,
    roleLabel: roleLabel(active.role),
    tenantName: active.tenant.name,
    subtitle: `${roleLabel(active.role)} · ${scopeLabel(active)}`,
    businesses: session.memberships.map((membership) => ({
      id: membership.id,
      name: membership.tenant.name,
      initial: membership.tenant.name.trim()[0]?.toUpperCase() ?? '?',
      active: membership.id === active.id,
    })),
  };
}
