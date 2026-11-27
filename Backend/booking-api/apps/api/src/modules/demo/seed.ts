// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { PrismaClient, Tx } from '@tempora/db';
import { nextInvoicePrefix } from '../bookings/invoice-number.js';
import { buildDemoPlan, DEMO_TENANT_IDS, type DemoPlan, type DemoPlanInput } from './plan.js';
import { DEMO_TENANTS } from './world.js';

/**
 * Writes the demo (FSD 10.3) with the owner role, in one transaction: the demo businesses are
 * removed with everything in them and created again, so seeding is also the reset. Other
 * businesses (created by visitors) are not touched.
 *
 * The demo accounts are matched by email: an account that is still a member somewhere else
 * (a visitor invited it to their own business) stays, with the demo password again, and the
 * demo's rows point to it. Everyone signed in with a demo account is logged out.
 */

/** Tables with a `tenant_id`, children before parents (foreign keys). */
const TENANT_TABLES = [
  'email_messages',
  'audit_logs',
  'support_grants',
  'booking_access_tokens',
  'payments',
  'invoices',
  'invoice_counters',
  'bookings',
  'tenant_customers',
  'staff_time_off',
  'staff_working_hours',
  'staff_services',
  'invitations',
  'services',
  'branch_closures',
  'branch_opening_hours',
  'memberships',
  'branches',
] as const;

/** Inserted in slices, well below PostgreSQL's limit of parameters per statement. */
const SLICE = 1000;

async function insert<T>(rows: T[], write: (slice: T[]) => Promise<unknown>) {
  for (let i = 0; i < rows.length; i += SLICE) await write(rows.slice(i, i + SLICE));
}

async function clear(tx: Tx, plan: DemoPlan) {
  const tenants = DEMO_TENANT_IDS;
  const teamEmails = plan.teamAccounts.map((a) => a.email);
  const customerEmails = plan.customerAccounts.map((a) => a.email);
  const adminEmails = plan.platformAdmins.map((a) => a.email);
  // The plan's account IDs are fixed, so an account seeded under another email domain
  // (DEMO_EMAIL_DOMAIN changed) still holds them: match by ID as well as by address.
  const teamIds = plan.teamAccounts.map((a) => a.id!);
  const customerIds = plan.customerAccounts.map((a) => a.id!);
  const adminIds = plan.platformAdmins.map((a) => a.id!);

  // Sign-ins first: a session must keep exactly one subject, so it cannot outlive its account.
  await tx.$executeRaw`
    DELETE FROM otp_challenges
    WHERE team_account_id IN (SELECT id FROM team_accounts WHERE email = ANY(${teamEmails}) OR id = ANY(${teamIds}::uuid[]))
       OR platform_admin_id IN (SELECT id FROM platform_admins WHERE email = ANY(${adminEmails}) OR id = ANY(${adminIds}::uuid[]))`;
  await tx.$executeRaw`
    DELETE FROM sessions
    WHERE membership_id IN (SELECT id FROM memberships WHERE tenant_id = ANY(${tenants}::uuid[]))
       OR team_account_id IN (SELECT id FROM team_accounts WHERE email = ANY(${teamEmails}) OR id = ANY(${teamIds}::uuid[]))
       OR customer_account_id IN (SELECT id FROM customer_accounts WHERE email = ANY(${customerEmails}) OR id = ANY(${customerIds}::uuid[]))
       OR platform_admin_id IN (SELECT id FROM platform_admins WHERE email = ANY(${adminEmails}) OR id = ANY(${adminIds}::uuid[]))`;
  await tx.$executeRaw`
    DELETE FROM trusted_devices
    WHERE team_account_id IN (SELECT id FROM team_accounts WHERE email = ANY(${teamEmails}) OR id = ANY(${teamIds}::uuid[]))`;
  await tx.$executeRaw`
    DELETE FROM auth_tokens
    WHERE team_account_id IN (SELECT id FROM team_accounts WHERE email = ANY(${teamEmails}) OR id = ANY(${teamIds}::uuid[]))
       OR customer_account_id IN (SELECT id FROM customer_accounts WHERE email = ANY(${customerEmails}) OR id = ANY(${customerIds}::uuid[]))`;

  for (const table of TENANT_TABLES) {
    await tx.$executeRawUnsafe(`DELETE FROM "${table}" WHERE tenant_id = ANY($1::uuid[])`, tenants);
  }
  await tx.$executeRaw`DELETE FROM tenants WHERE id = ANY(${tenants}::uuid[])`;

  // Accounts nobody else uses any more.
  await tx.$executeRaw`
    DELETE FROM team_accounts a WHERE (email = ANY(${teamEmails}) OR id = ANY(${teamIds}::uuid[]))
      AND NOT EXISTS (SELECT 1 FROM memberships m WHERE m.team_account_id = a.id)`;
  await tx.$executeRaw`
    DELETE FROM customer_accounts a WHERE (email = ANY(${customerEmails}) OR id = ANY(${customerIds}::uuid[]))
      AND NOT EXISTS (SELECT 1 FROM tenant_customers c WHERE c.customer_account_id = a.id)`;
  await tx.$executeRaw`DELETE FROM platform_admins WHERE email = ANY(${adminEmails}) OR id = ANY(${adminIds}::uuid[])`;
}

/** Creates the accounts that are missing, resets the others; returns plan ID → real ID. */
async function accounts(tx: Tx, plan: DemoPlan): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  await tx.teamAccount.createMany({ data: plan.teamAccounts, skipDuplicates: true });
  await tx.customerAccount.createMany({ data: plan.customerAccounts, skipDuplicates: true });
  await tx.platformAdmin.createMany({ data: plan.platformAdmins, skipDuplicates: true });
  for (const account of plan.teamAccounts) {
    const row = await tx.teamAccount.update({
      where: { email: account.email },
      data: {
        name: account.name,
        passwordHash: account.passwordHash,
        passwordChangedAt: new Date(),
      },
    });
    ids.set(account.id!, row.id);
  }
  for (const account of plan.customerAccounts) {
    const row = await tx.customerAccount.update({
      where: { email: account.email },
      data: {
        name: account.name,
        passwordHash: account.passwordHash,
        passwordChangedAt: new Date(),
      },
    });
    ids.set(account.id!, row.id);
  }
  return ids;
}

/**
 * The demo's addresses must be free (two businesses cannot share one); an invoice prefix taken
 * by another business is replaced by the next free one, as at sign-up (`LUM` → `LUM2`).
 */
async function demoPrefixes(owner: PrismaClient): Promise<Record<string, string>> {
  const others = await owner.tenant.findMany({
    where: { id: { notIn: DEMO_TENANT_IDS } },
    select: { slug: true, invoicePrefix: true },
  });
  const clash = others.filter((t) => DEMO_TENANTS.some((d) => d.slug === t.slug));
  if (clash.length > 0) {
    throw new Error(
      `Another business already uses a demo address: ${clash.map((t) => t.slug).join(', ')}. Seed into a database without it.`,
    );
  }
  const taken = others.map((t) => t.invoicePrefix);
  return Object.fromEntries(
    DEMO_TENANTS.map((d) => [d.slug, nextInvoicePrefix(d.invoicePrefix, taken)]),
  );
}

async function write(tx: Tx, plan: DemoPlan) {
  await clear(tx, plan);
  const ids = await accounts(tx, plan);
  const real = (id: string | null | undefined) => (id ? (ids.get(id) ?? id) : (id ?? null));

  await tx.tenant.createMany({ data: plan.tenants });
  await tx.branch.createMany({ data: plan.branches });
  await tx.branchOpeningHours.createMany({ data: plan.openingHours });
  await tx.service.createMany({ data: plan.services });
  await tx.membership.createMany({
    data: plan.memberships.map((m) => ({ ...m, teamAccountId: real(m.teamAccountId)! })),
  });
  await tx.staffService.createMany({ data: plan.staffServices });
  await tx.staffWorkingHours.createMany({ data: plan.workingHours });
  await tx.tenantCustomer.createMany({
    data: plan.tenantCustomers.map((c) => ({ ...c, customerAccountId: real(c.customerAccountId) })),
  });
  await insert(plan.bookings, (data) => tx.booking.createMany({ data }));
  await insert(plan.invoices, (data) => tx.invoice.createMany({ data }));
  await tx.invoiceCounter.createMany({ data: plan.invoiceCounters });
  await insert(plan.payments, (data) => tx.payment.createMany({ data }));
  await insert(plan.auditLogs, (data) => tx.auditLog.createMany({ data }));
  await insert(plan.emails, (data) => tx.emailMessage.createMany({ data }));
}

export interface SeedResult {
  seeded: boolean;
  bookings: number;
}

/**
 * Seeds the demo. Without `reset`, it does nothing when the demo is already there, so
 * `docker compose up` keeps what you changed locally; with `reset`, it starts again.
 */
export async function seedDemo(
  owner: PrismaClient,
  input: DemoPlanInput,
  { reset = false }: { reset?: boolean } = {},
): Promise<SeedResult> {
  if (!reset && (await owner.tenant.findUnique({ where: { id: DEMO_TENANT_IDS[0]! } }))) {
    return { seeded: false, bookings: 0 };
  }
  const plan = buildDemoPlan({ ...input, invoicePrefixes: await demoPrefixes(owner) });
  await owner.$transaction((tx) => write(tx, plan), { timeout: 180_000, maxWait: 30_000 });
  return { seeded: true, bookings: plan.bookings.length };
}
