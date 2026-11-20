// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type {
  SupportAccess,
  SupportBookingQuery,
  SupportCustomerQuery,
  SupportInvoiceQuery,
} from '@tempora/contracts';
import { setDbContext, withDbContext, type PrismaClient, type Tx } from '@tempora/db';
import { AppError } from '../../lib/app-error.js';
import { recordAudit, type AuditActor } from '../../lib/audit.js';
import type { AdminActor } from '../admin-auth/guard.js';
import { notFound, type Viewer } from '../console-auth/access.js';
import type { ConsoleBookingService } from '../console-bookings/service.js';
import type { ConsoleRecordsService } from '../console-records/service.js';

interface ActiveGrant {
  id: string;
  starts_at: Date;
  expires_at: Date;
}

/** The tenant's active support grant on the API clock, or null (`active_support_grant`). */
export async function activeSupportGrant(
  tx: Tx,
  tenantId: string,
  at: Date,
): Promise<ActiveGrant | null> {
  const [grant] = await tx.$queryRaw<
    ActiveGrant[]
  >`SELECT * FROM active_support_grant(${tenantId}::uuid, ${at})`;
  return grant ?? null;
}

export const toSupportAccess = (grant: ActiveGrant): SupportAccess => ({
  startsAt: grant.starts_at.toISOString(),
  expiresAt: grant.expires_at.toISOString(),
});

const noAccess = () =>
  new AppError({
    status: 403,
    code: 'SUPPORT_ACCESS_REQUIRED',
    title: 'Support access needed',
    detail: 'The owner has not granted support access, or it has ended.',
  });

type View =
  | { view: 'bookings'; filters: object }
  | { view: 'booking'; recordId: string }
  | { view: 'customers'; filters: object }
  | { view: 'customer'; recordId: string }
  | { view: 'invoices'; filters: object }
  | { view: 'invoice'; recordId: string };

export interface SupportViewDeps {
  prisma: PrismaClient;
  bookings: ConsoleBookingService;
  records: ConsoleRecordsService;
  now?: () => Date;
}

/**
 * The Platform Admin's support views (FSD 1.4, 2.3, 3.10): the Console's bookings, customers
 * and invoices of a tenant whose owner granted access, read only.
 *
 * Each view first checks the grant and writes `support.viewed` to the tenant's log (and the
 * platform log), then reads in a second transaction whose only RLS context is the grant.
 * Logging first fails closed: no log entry, no data. If the owner revokes in between, the
 * database already refuses the rows.
 */
export function createSupportViewService({
  prisma,
  bookings,
  records,
  now = () => new Date(),
}: SupportViewDeps) {
  const actorOf = (actor: AdminActor): AuditActor => ({
    type: 'platform_admin',
    id: actor.adminId,
    label: `${actor.name} (Tempora support)`,
    requestId: actor.requestId,
    ip: actor.ip,
  });

  async function open(actor: AdminActor, tenantId: string, view: View): Promise<Viewer> {
    const grantId = await withDbContext(prisma, { platformAdminId: actor.adminId }, async (tx) => {
      const tenant = await tx.tenant.findFirst({ where: { id: tenantId, archivedAt: null } });
      if (!tenant) throw notFound('Tenant');
      const grant = await activeSupportGrant(tx, tenantId, now());
      if (!grant) throw noAccess();

      const { view: name, ...detail } = view;
      // Platform log (platform context), then the tenant's log through the grant: the
      // support context may write only this one kind of entry (RLS `support_viewed`).
      await recordAudit(tx, actorOf(actor), {
        tenantId: null,
        action: 'support.viewed',
        entityType: 'tenant',
        entityId: tenantId,
        after: { view: name, ...detail },
      });
      await setDbContext(tx, { supportGrantId: grant.id });
      await recordAudit(tx, actorOf(actor), {
        tenantId,
        action: 'support.viewed',
        entityType: 'support_grant',
        entityId: grant.id,
        after: { view: name, ...detail },
      });
      return grant.id;
    });
    // What the owner sees, every branch; the grant context keeps it read only.
    return { role: 'owner', branchId: null, membershipId: '', tenantId, supportGrantId: grantId };
  }

  return {
    bookings: async (actor: AdminActor, tenantId: string, query: SupportBookingQuery) =>
      bookings.list(await open(actor, tenantId, { view: 'bookings', filters: query }), query),
    booking: async (actor: AdminActor, tenantId: string, id: string) =>
      bookings.detail(await open(actor, tenantId, { view: 'booking', recordId: id }), id),
    customers: async (actor: AdminActor, tenantId: string, query: SupportCustomerQuery) =>
      records.customers(await open(actor, tenantId, { view: 'customers', filters: query }), query),
    customer: async (actor: AdminActor, tenantId: string, id: string) =>
      records.customer(await open(actor, tenantId, { view: 'customer', recordId: id }), id),
    invoices: async (actor: AdminActor, tenantId: string, query: SupportInvoiceQuery) =>
      records.invoices(await open(actor, tenantId, { view: 'invoices', filters: query }), query),
    invoice: async (actor: AdminActor, tenantId: string, id: string) =>
      records.invoice(await open(actor, tenantId, { view: 'invoice', recordId: id }), id),
  };
}

export type SupportViewService = ReturnType<typeof createSupportViewService>;
