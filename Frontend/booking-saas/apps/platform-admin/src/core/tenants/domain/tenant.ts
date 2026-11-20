// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

/** Tenants as the Platform Admin sees them (FSD 2.3): metadata and usage, no business data. */

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: 'active' | 'suspended';
  /** Active but cannot take bookings yet (FSD 3.4). */
  onboarding: boolean;
  createdAt: Date;
  members: number;
  recentBookings: number;
}

export interface TenantDetail extends Tenant {
  invoicePrefix: string;
  suspendedAt: Date | null;
  suspensionReason: string | null;
  owner: { name: string; email: string } | null;
  ownerInvitation: { email: string; status: 'pending' | 'expired'; expiresAt: Date } | null;
  /** The owner's active support grant (FSD 1.4); null while support views are closed. */
  supportAccess: { startsAt: Date; expiresAt: Date } | null;
}

export type TenantFilter = 'active' | 'onboarding' | 'suspended';

export interface TenantQuery {
  q?: string | undefined;
  status?: TenantFilter | undefined;
  page: number;
}

export interface TenantPage {
  items: Tenant[];
  page: number;
  pageSize: number;
  total: number;
}

export interface NewTenant {
  businessName: string;
  slug: string;
  ownerEmail: string;
}

export interface AuditEntry {
  id: string;
  at: Date;
  actor: string;
  action: string;
  entityId: string | null;
  reason: string | null;
  after: unknown;
}

/** Implemented by the data layer; failures are `RequestError`s. */
export interface TenantRepository {
  list(query: TenantQuery): Promise<TenantPage>;
  get(id: string): Promise<TenantDetail>;
  create(input: NewTenant): Promise<TenantDetail>;
  suspend(id: string, reason: string): Promise<TenantDetail>;
  reactivate(id: string): Promise<TenantDetail>;
  audit(page: number): Promise<{ items: AuditEntry[]; total: number; pageSize: number }>;
}

/** The status a person reads first: suspended, still onboarding, or active. */
export function displayStatus(tenant: Pick<Tenant, 'status' | 'onboarding'>): TenantFilter {
  if (tenant.status === 'suspended') return 'suspended';
  return tenant.onboarding ? 'onboarding' : 'active';
}

/** A slug suggestion from a business name: "Harbor Bodywork & Spa" → "harbor-bodywork-spa". */
export function suggestSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
}
