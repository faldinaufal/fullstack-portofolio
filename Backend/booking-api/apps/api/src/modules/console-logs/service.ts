// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type {
  AuditLogEntry,
  AuditLogPage,
  AuditLogQuery,
  EmailLogPage,
  EmailLogQuery,
} from '@tempora/contracts';
import { Prisma, withDbContext, type PrismaClient, type Tx } from '@tempora/db';
import { AppError } from '../../lib/app-error.js';
import { csvDateTime, csvStream } from '../../lib/csv.js';
import type { ConsoleActor } from '../console-auth/guard.js';
import { auditExport, dateRange, exportFileName } from '../console-bookings/rows.js';
import { escapeLike } from '../public/service.js';

interface AuditRow {
  id: string;
  created_at: Date;
  actor_type: AuditLogEntry['actor']['type'];
  actor_label: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  branch_id: string | null;
  branch_name: string | null;
  before: unknown;
  after: unknown;
  reason: string | null;
}

interface EmailRow {
  id: string;
  to_email: string;
  template: string;
  status: EmailLogPage['items'][number]['status'];
  attempts: number;
  last_error: string | null;
  created_at: Date;
  sent_at: Date | null;
  next_attempt_at: Date;
  booking_id: string | null;
}

/** Keyset cursor `<created_at ISO>|<id>`, base64url: the position after the last entry. */
export const encodeCursor = (row: { created_at: Date; id: string }) =>
  Buffer.from(`${row.created_at.toISOString()}|${row.id}`).toString('base64url');

export function decodeCursor(cursor: string): { at: Date; id: string } {
  const [at, id] = Buffer.from(cursor, 'base64url').toString().split('|');
  const date = new Date(at ?? '');
  if (!id || Number.isNaN(date.getTime()) || !/^[0-9a-f-]{36}$/.test(id)) {
    throw new AppError({
      status: 400,
      code: 'VALIDATION_FAILED',
      title: 'Invalid cursor',
      detail: 'Start again from the first page.',
      errors: [{ path: 'cursor', message: 'Not a cursor of this list.' }],
    });
  }
  return { at: date, id };
}

export interface ConsoleLogDeps {
  prisma: PrismaClient;
  timeZone: string;
  now?: () => Date;
}

/**
 * The audit log and the email log of the Console (FSD 2.2, 5.4): owner and managers.
 *
 * Scope (FSD 1.2): the owner sees the whole tenant. A manager sees entries of their branch
 * only, so no tenant-level entries (business settings, support access), and not what the
 * owner did to managers (promoting, moving, replacing one). Emails: a manager sees those about
 * their branch (`email_messages.branch_id`: booking emails and staff invitations).
 */
export function createConsoleLogService({
  prisma,
  timeZone,
  now = () => new Date(),
}: ConsoleLogDeps) {
  const inTenant = <T>(actor: ConsoleActor, work: (tx: Tx) => Promise<T>) =>
    withDbContext(prisma, { tenantId: actor.tenantId, teamAccountId: actor.teamAccountId }, work);

  type AuditFilters = Omit<AuditLogQuery, 'cursor' | 'limit' | 'format'>;

  function auditWhere(actor: ConsoleActor, query: AuditFilters): Prisma.Sql {
    const parts: Prisma.Sql[] = [Prisma.sql`TRUE`];
    if (actor.role === 'manager') {
      parts.push(Prisma.sql`a.branch_id = ${actor.branchId}::uuid`);
      // Entries about a manager's membership or invitation (role before or after).
      parts.push(Prisma.sql`NOT (a.entity_type IN ('membership', 'invitation') AND (
        coalesce(a.before ->> 'role', '') = 'manager' OR coalesce(a.after ->> 'role', '') = 'manager'
      ))`);
    }
    if (query.actor) parts.push(Prisma.sql`a.actor_label ILIKE ${`%${escapeLike(query.actor)}%`}`);
    if (query.action) {
      parts.push(
        query.action.endsWith('.')
          ? Prisma.sql`a.action LIKE ${`${escapeLike(query.action)}%`}`
          : Prisma.sql`a.action = ${query.action}`,
      );
    }
    if (query.entityType) parts.push(Prisma.sql`a.entity_type = ${query.entityType}`);
    if (query.entityId) parts.push(Prisma.sql`a.entity_id = ${query.entityId}::uuid`);
    const range = dateRange(timeZone, query.from, query.to);
    if (range?.gte) parts.push(Prisma.sql`a.created_at >= ${range.gte}`);
    if (range?.lt) parts.push(Prisma.sql`a.created_at < ${range.lt}`);
    return Prisma.sql`WHERE ${Prisma.join(parts, ' AND ')}`;
  }

  /** Newest first; `(created_at, id)` breaks ties, so a cursor never skips or repeats. */
  const auditRows = (
    tx: Tx,
    actor: ConsoleActor,
    query: AuditFilters,
    page: { after?: { at: Date; id: string }; limit: number; offset?: number },
  ) => {
    const where = auditWhere(actor, query);
    const after = page.after
      ? Prisma.sql`AND (a.created_at, a.id) < (${page.after.at}, ${page.after.id}::uuid)`
      : Prisma.empty;
    return tx.$queryRaw<AuditRow[]>`
      SELECT a.id, a.created_at, a.actor_type, a.actor_label, a.action, a.entity_type,
        a.entity_id, a.branch_id, b.name AS branch_name, a.before, a.after, a.reason
      FROM audit_logs a
      LEFT JOIN branches b ON b.id = a.branch_id
      ${where} ${after}
      ORDER BY a.created_at DESC, a.id DESC
      LIMIT ${page.limit} OFFSET ${page.offset ?? 0}`;
  };

  const toEntry = (row: AuditRow): AuditLogEntry => ({
    id: row.id,
    at: row.created_at.toISOString(),
    actor: { type: row.actor_type, label: row.actor_label },
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    branch: row.branch_id ? { id: row.branch_id, name: row.branch_name ?? '' } : null,
    before: row.before,
    after: row.after,
    reason: row.reason,
  });

  const filtersOf = ({ cursor: _c, limit: _l, format: _f, ...filters }: AuditLogQuery) => filters;

  function emailWhere(actor: ConsoleActor, query: EmailLogQuery): Prisma.Sql {
    const parts: Prisma.Sql[] = [Prisma.sql`TRUE`];
    if (actor.role === 'manager') {
      parts.push(Prisma.sql`e.branch_id = ${actor.branchId}::uuid`);
    }
    if (query.status) parts.push(Prisma.sql`e.status = ${query.status}::email_status`);
    if (query.q)
      parts.push(Prisma.sql`e.to_email LIKE ${`%${escapeLike(query.q.toLowerCase())}%`}`);
    return Prisma.sql`WHERE ${Prisma.join(parts, ' AND ')}`;
  }

  return {
    audit: (actor: ConsoleActor, query: AuditLogQuery): Promise<AuditLogPage> =>
      inTenant(actor, async (tx) => {
        const after = query.cursor ? decodeCursor(query.cursor) : undefined;
        // One extra row tells whether another page follows.
        const rows = await auditRows(tx, actor, query, {
          ...(after && { after }),
          limit: query.limit + 1,
        });
        const page = rows.slice(0, query.limit);
        const last = page.at(-1);
        return {
          items: page.map(toEntry),
          nextCursor: rows.length > query.limit && last ? encodeCursor(last) : null,
          timeZone,
        };
      }),

    /** Every entry with the same filters and scope (at most 10,000), audited (FSD 5.1). */
    async exportAudit(actor: ConsoleActor, query: AuditLogQuery) {
      const filters = filtersOf(query);
      await inTenant(actor, async (tx) => {
        const [count] = await tx.$queryRaw<{ n: number }[]>`
          SELECT count(*)::int AS n FROM audit_logs a ${auditWhere(actor, filters)}`;
        await auditExport(tx, actor, 'audit', filters, count?.n ?? 0);
      });
      return {
        fileName: exportFileName('audit-log', now()),
        stream: csvStream(
          [
            'When',
            'Who',
            'Actor type',
            'Action',
            'Entity',
            'Entity ID',
            'Branch',
            'Reason',
            'Before',
            'After',
          ],
          (n, size) =>
            inTenant(actor, (tx) =>
              auditRows(tx, actor, filters, { limit: size, offset: (n - 1) * size }),
            ),
          (row) => [
            csvDateTime(row.created_at, timeZone),
            row.actor_label,
            row.actor_type,
            row.action,
            row.entity_type,
            row.entity_id,
            row.branch_name,
            row.reason,
            row.before === null ? null : JSON.stringify(row.before),
            row.after === null ? null : JSON.stringify(row.after),
          ],
        ),
      };
    },

    emails: (actor: ConsoleActor, query: EmailLogQuery): Promise<EmailLogPage> =>
      inTenant(actor, async (tx) => {
        const where = emailWhere(actor, query);
        const rows = await tx.$queryRaw<EmailRow[]>`
          SELECT e.id, e.to_email, e.template, e.status, e.attempts, e.last_error, e.created_at,
            e.sent_at, e.next_attempt_at, e.booking_id
          FROM email_messages e ${where}
          ORDER BY e.created_at DESC, e.id DESC
          LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`;
        const [count] = await tx.$queryRaw<{ n: number }[]>`
          SELECT count(*)::int AS n FROM email_messages e ${where}`;
        return {
          items: rows.map((row) => ({
            id: row.id,
            to: row.to_email,
            template: row.template,
            status: row.status,
            attempts: row.attempts,
            lastError: row.last_error,
            createdAt: row.created_at.toISOString(),
            sentAt: row.sent_at?.toISOString() ?? null,
            nextAttemptAt: row.status === 'queued' ? row.next_attempt_at.toISOString() : null,
            bookingId: row.booking_id,
          })),
          page: query.page,
          pageSize: query.pageSize,
          total: count?.n ?? 0,
          timeZone,
        };
      }),
  };
}

export type ConsoleLogService = ReturnType<typeof createConsoleLogService>;
