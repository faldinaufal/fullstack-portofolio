// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

/** A weekly opening interval. Times are `HH:MM` in the platform time zone. */
export interface OpeningHours {
  /** 0 = Sunday … 6 = Saturday. */
  weekday: number;
  opensAt: string;
  closesAt: string;
}

export interface Closure {
  id: string;
  /** `YYYY-MM-DD`, inclusive. */
  startsOn: string;
  endsOn: string;
  reason: string;
}

export interface Branch {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  archived: boolean;
  /** Sent back when saving, so a concurrent change is detected (optimistic locking). */
  version: number;
  activeMembers: number;
}

export interface BranchDetail extends Branch {
  openingHours: OpeningHours[];
  closures: Closure[];
}

export interface BranchInput {
  name: string;
  address: string | null;
  phone: string | null;
}

export interface BranchRepository {
  list(): Promise<Branch[]>;
  get(id: string): Promise<BranchDetail>;
  create(input: BranchInput): Promise<BranchDetail>;
  update(id: string, version: number, input: BranchInput): Promise<BranchDetail>;
  archive(id: string): Promise<BranchDetail>;
  replaceOpeningHours(id: string, hours: OpeningHours[]): Promise<BranchDetail>;
  addClosure(id: string, closure: Omit<Closure, 'id'>): Promise<Closure>;
  removeClosure(id: string, closureId: string): Promise<void>;
}
