// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { AppError } from '../../lib/app-error.js';
import type { ConsoleRole } from './guard.js';

/**
 * Scope rules of the permission matrix (FSD 1.2): which branch and which members a Console
 * user may see or change. Pure functions, so every rule is unit-tested on its own; services
 * call them after loading the target record.
 */

export interface Scope {
  role: ConsoleRole;
  /** Null for owners. */
  branchId: string | null;
  membershipId: string;
}

export interface MemberRef {
  id: string;
  role: ConsoleRole;
  branchId: string | null;
}

/** Owners see every branch; managers and staff only their own. */
export function canSeeBranch(scope: Scope, branchId: string): boolean {
  return scope.role === 'owner' || scope.branchId === branchId;
}

/** Branch details, opening hours and closures: owner, or the manager of that branch. */
export function canEditBranch(scope: Scope, branchId: string): boolean {
  return scope.role === 'owner' || (scope.role === 'manager' && scope.branchId === branchId);
}

/** Owner invites managers and staff anywhere; a manager invites staff to their own branch. */
export function canInvite(scope: Scope, role: 'manager' | 'staff', branchId: string): boolean {
  if (scope.role === 'owner') return true;
  return scope.role === 'manager' && role === 'staff' && scope.branchId === branchId;
}

/** Who may see a member record (lists and detail). */
export function canSeeMember(scope: Scope, member: MemberRef): boolean {
  if (scope.role === 'owner') return true;
  if (scope.role === 'manager') return member.branchId === scope.branchId;
  return member.id === scope.membershipId;
}

/**
 * Deactivate / reactivate: owner for any manager or staff; a manager for staff of their own
 * branch. Nobody changes the owner here (ownership transfer has its own flow) or themselves.
 */
export function canManageMember(scope: Scope, member: MemberRef): boolean {
  if (member.role === 'owner' || member.id === scope.membershipId) return false;
  if (scope.role === 'owner') return true;
  return scope.role === 'manager' && member.role === 'staff' && member.branchId === scope.branchId;
}

/**
 * Working hours and services a therapist performs: owner for anyone, a manager for the
 * members of their own branch, themselves included (FSD 1.2 Team).
 */
export function canEditSchedule(scope: Scope, member: MemberRef): boolean {
  if (scope.role === 'owner') return true;
  return scope.role === 'manager' && member.branchId === scope.branchId;
}

/** Time off: like schedules, plus staff for their own (FSD 1.2 "Therapist time off"). */
export function canManageTimeOff(scope: Scope, member: MemberRef): boolean {
  return canEditSchedule(scope, member) || member.id === scope.membershipId;
}

/**
 * Outside the caller's scope, a record does not exist for them: `404`, never `403`, so the
 * existence of another branch's data is not revealed (FSD 1.3 step 3).
 */
export function notFound(what = 'Record'): AppError {
  return new AppError({
    status: 404,
    code: 'NOT_FOUND',
    title: 'Not found',
    detail: `${what} not found.`,
  });
}

export function forbidden(detail: string): AppError {
  return new AppError({ status: 403, code: 'FORBIDDEN', title: 'Not allowed', detail });
}
