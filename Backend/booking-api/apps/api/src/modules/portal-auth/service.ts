// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import {
  passwordContainsEmail,
  type ChangePasswordRequest,
  type CustomerLoginRequest,
  type CustomerProfile,
  type CustomerSignupRequest,
  type ForgotPasswordRequest,
  type ResetPasswordRequest,
  type SessionList,
  type UpdateCustomerProfileRequest,
} from '@tempora/contracts';
import { Prisma, withDbContext, type PrismaClient, type Tx } from '@tempora/db';
import type { OutboxEmail } from '@tempora/db/emails';
import { AppError } from '../../lib/app-error.js';
import type { PasswordHasher } from '../../lib/passwords.js';
import { type RateLimiter, type RateLimitRule } from '../../lib/rate-limit.js';
import { generateToken, type TokenHasher } from '../../lib/tokens.js';
import { describeDevice } from '../../lib/user-agent.js';
import { notFound } from '../console-auth/access.js';
import type { IssuedToken, RequestMeta } from '../console-auth/service.js';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Portal rules (FSD 6.11). */
export const PORTAL_AUTH_POLICY = {
  /** 30 days, renewed on activity: each use pushes the end 30 days ahead. */
  sessionLifetimeMs: 30 * DAY,
  sessionTouchIntervalMs: MINUTE,
  emailVerifyTtlMs: 24 * HOUR,
  passwordResetTtlMs: HOUR,
} as const;

export const PORTAL_RATE_LIMITS = {
  loginFailure: { bucket: 'portal.login.failure', max: 5, windowMs: 15 * MINUTE },
  signup: { bucket: 'portal.signup', max: 5, windowMs: HOUR },
  passwordReset: { bucket: 'portal.password.reset', max: 5, windowMs: 15 * MINUTE },
  verificationEmail: { bucket: 'portal.verify.resend', max: 3, windowMs: HOUR },
} satisfies Record<string, RateLimitRule>;

/** The signed-in customer, attached to authenticated Portal requests. */
export interface CustomerAuth {
  sessionId: string;
  customerAccountId: string;
}

const invalidCredentials = () =>
  new AppError({
    status: 401,
    code: 'INVALID_CREDENTIALS',
    title: 'Wrong email or password',
    detail: 'The email or password is incorrect.',
  });

const tokenInvalid = () =>
  new AppError({
    status: 410,
    code: 'TOKEN_INVALID',
    title: 'Link no longer valid',
    detail: 'This link is invalid, was already used or has expired. Request a new one.',
  });

const passwordContainsEmailError = (path: string) =>
  new AppError({
    status: 400,
    code: 'VALIDATION_FAILED',
    title: 'Invalid request',
    detail: 'The password must not contain your email address.',
    errors: [{ path, message: 'Must not contain your email address.' }],
  });

type AccountRow = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  emailVerifiedAt: Date | null;
};

const toProfile = (account: AccountRow): CustomerProfile => ({
  id: account.id,
  email: account.email,
  name: account.name,
  phone: account.phone,
  emailVerified: account.emailVerifiedAt !== null,
});

export interface PortalAuthServiceDeps {
  prisma: PrismaClient;
  passwords: PasswordHasher;
  hashToken: TokenHasher;
  rateLimiter: RateLimiter;
  /** Portal origin, for links in emails. */
  portalUrl: string;
  now?: () => Date;
}

/**
 * Customer accounts for the Portal (FSD 5.3, 6.11). Customer accounts are platform-wide, not
 * tenant-owned, so these queries need no RLS context. Unlike the Console there is no second
 * factor: customers do not change business data, and FSD 6.11 scopes 2FA to team accounts.
 */
export function createPortalAuthService({
  prisma,
  passwords,
  hashToken,
  rateLimiter,
  portalUrl,
  now = () => new Date(),
}: PortalAuthServiceDeps) {
  const tx = <T>(work: (tx: Tx) => Promise<T>) => withDbContext(prisma, {}, work);

  const enqueue = (t: Tx, email: OutboxEmail) =>
    t.emailMessage.createMany({
      data: [
        { tenantId: null, toEmail: email.to, template: email.template, payload: email.payload },
      ],
    });

  async function startSession(
    t: Tx,
    customerAccountId: string,
    meta: RequestMeta,
  ): Promise<IssuedToken> {
    const token = generateToken();
    const at = now();
    const expiresAt = new Date(at.getTime() + PORTAL_AUTH_POLICY.sessionLifetimeMs);
    await t.session.create({
      data: {
        tokenHash: hashToken('session', token),
        app: 'portal',
        customerAccountId,
        createdAt: at,
        lastSeenAt: at,
        expiresAt,
        ip: meta.ip,
        userAgent: meta.userAgent?.slice(0, 300) ?? null,
      },
    });
    return { token, expiresAt };
  }

  async function sendVerification(t: Tx, account: { id: string; email: string; name: string }) {
    const token = generateToken();
    const at = now();
    await t.authToken.create({
      data: {
        purpose: 'email_verify',
        customerAccountId: account.id,
        tokenHash: hashToken('email-verify', token),
        createdAt: at,
        expiresAt: new Date(at.getTime() + PORTAL_AUTH_POLICY.emailVerifyTtlMs),
      },
    });
    const verifyUrl = new URL('/verify-email', portalUrl);
    verifyUrl.searchParams.set('token', token);
    await enqueue(t, {
      tenantId: null,
      to: account.email,
      template: 'portal.verify_email',
      payload: {
        name: account.name,
        verifyUrl: verifyUrl.toString(),
        expiresInHours: PORTAL_AUTH_POLICY.emailVerifyTtlMs / HOUR,
      },
    });
  }

  async function account(customerAccountId: string) {
    const row = await tx((t) => t.customerAccount.findUnique({ where: { id: customerAccountId } }));
    if (!row) throw new AppError({ status: 401, code: 'UNAUTHENTICATED', title: 'Session ended' });
    return row;
  }

  return {
    /** Creates the account and logs in at once; the verification email follows (FSD 5.3). */
    async signup(input: CustomerSignupRequest, meta: RequestMeta) {
      await rateLimiter.assertAllowed(PORTAL_RATE_LIMITS.signup, meta.ip);
      if (passwordContainsEmail(input.password, input.email))
        throw passwordContainsEmailError('password');
      await rateLimiter.record(PORTAL_RATE_LIMITS.signup, meta.ip);
      const passwordHash = await passwords.hash(input.password);
      try {
        return await tx(async (t) => {
          const created = await t.customerAccount.create({
            data: {
              email: input.email,
              name: input.name,
              phone: input.phone ?? null,
              passwordHash,
            },
          });
          await sendVerification(t, created);
          return { profile: toProfile(created), session: await startSession(t, created.id, meta) };
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          throw new AppError({
            status: 409,
            code: 'EMAIL_TAKEN',
            title: 'Email already registered',
            detail: 'An account with this email already exists. Log in instead.',
            errors: [{ path: 'email', message: 'Already registered.' }],
          });
        }
        throw error;
      }
    },

    /** Same answer and time for an unknown email and a wrong password (FSD 6.11). */
    async login(input: CustomerLoginRequest, meta: RequestMeta) {
      const limitKey = `${input.email}\n${meta.ip}`;
      await rateLimiter.assertAllowed(PORTAL_RATE_LIMITS.loginFailure, limitKey);
      const found = await tx((t) =>
        t.customerAccount.findUnique({ where: { email: input.email } }),
      );
      const ok = found
        ? await passwords.verify(found.passwordHash, input.password)
        : (await passwords.burnTime(input.password), false);
      if (!found || !ok) {
        await rateLimiter.record(PORTAL_RATE_LIMITS.loginFailure, limitKey);
        throw invalidCredentials();
      }
      return {
        profile: toProfile(found),
        session: await tx((t) => startSession(t, found.id, meta)),
      };
    },

    /** Linking earlier guest bookings to the account follows with bookings (FSD 3.2). */
    async verifyEmail(token: string): Promise<CustomerProfile> {
      return tx(async (t) => {
        const row = await t.authToken.findFirst({
          where: { tokenHash: hashToken('email-verify', token), purpose: 'email_verify' },
        });
        if (!row?.customerAccountId || row.usedAt || row.expiresAt <= now()) throw tokenInvalid();
        const { count } = await t.authToken.updateMany({
          where: { id: row.id, usedAt: null },
          data: { usedAt: now() },
        });
        if (count !== 1) throw tokenInvalid();
        const verified = await t.customerAccount.update({
          where: { id: row.customerAccountId },
          data: { emailVerifiedAt: now() },
        });
        // FSD 3.2 step 5: guest bookings with this (now proven) email become this account's.
        await t.$queryRaw`SELECT link_guest_bookings(${verified.id}::uuid)`;
        return toProfile(verified);
      });
    },

    async resendVerification(auth: CustomerAuth): Promise<void> {
      const current = await account(auth.customerAccountId);
      if (current.emailVerifiedAt) return;
      await rateLimiter.assertAllowed(PORTAL_RATE_LIMITS.verificationEmail, current.id);
      await rateLimiter.record(PORTAL_RATE_LIMITS.verificationEmail, current.id);
      await tx((t) => sendVerification(t, current));
    },

    async forgotPassword(input: ForgotPasswordRequest, meta: RequestMeta): Promise<void> {
      const limitKey = `${input.email}\n${meta.ip}`;
      await rateLimiter.assertAllowed(PORTAL_RATE_LIMITS.passwordReset, limitKey);
      await rateLimiter.record(PORTAL_RATE_LIMITS.passwordReset, limitKey);
      await tx(async (t) => {
        const found = await t.customerAccount.findUnique({ where: { email: input.email } });
        if (!found) return;
        const token = generateToken();
        const at = now();
        await t.authToken.create({
          data: {
            purpose: 'password_reset',
            customerAccountId: found.id,
            tokenHash: hashToken('password-reset', token),
            createdAt: at,
            expiresAt: new Date(at.getTime() + PORTAL_AUTH_POLICY.passwordResetTtlMs),
          },
        });
        const resetUrl = new URL('/reset-password', portalUrl);
        resetUrl.searchParams.set('token', token);
        await enqueue(t, {
          tenantId: null,
          to: found.email,
          template: 'portal.password_reset',
          payload: {
            name: found.name,
            resetUrl: resetUrl.toString(),
            expiresInMinutes: PORTAL_AUTH_POLICY.passwordResetTtlMs / MINUTE,
          },
        });
      });
    },

    /** New password from the emailed link; ends every Portal session (FSD 5.3). */
    async resetPassword(input: ResetPasswordRequest): Promise<void> {
      const found = await tx(async (t) => {
        const row = await t.authToken.findFirst({
          where: { tokenHash: hashToken('password-reset', input.token), purpose: 'password_reset' },
          include: { customerAccount: true },
        });
        return row?.customerAccount && !row.usedAt && row.expiresAt > now() ? row : null;
      });
      if (!found?.customerAccount) throw tokenInvalid();
      const customer = found.customerAccount;
      if (passwordContainsEmail(input.password, customer.email))
        throw passwordContainsEmailError('password');
      const passwordHash = await passwords.hash(input.password);
      await tx(async (t) => {
        const { count } = await t.authToken.updateMany({
          where: { id: found.id, usedAt: null },
          data: { usedAt: now() },
        });
        if (count !== 1) throw tokenInvalid();
        await t.customerAccount.update({
          where: { id: customer.id },
          data: { passwordHash, passwordChangedAt: now() },
        });
        await t.session.updateMany({
          where: { customerAccountId: customer.id, revokedAt: null },
          data: { revokedAt: now() },
        });
        await enqueue(t, {
          tenantId: null,
          to: customer.email,
          template: 'portal.password_changed',
          payload: { name: customer.name },
        });
      });
    },

    /**
     * Resolves the session cookie on every request. The 30-day lifetime slides: each use
     * (at most once a minute) pushes the end 30 days ahead.
     */
    async authenticate(sessionToken: string): Promise<CustomerAuth | null> {
      const at = now();
      return tx(async (t) => {
        const session = await t.session.findFirst({
          where: { tokenHash: hashToken('session', sessionToken), app: 'portal' },
        });
        if (!session?.customerAccountId || session.revokedAt || session.expiresAt <= at)
          return null;
        if (
          at.getTime() - session.lastSeenAt.getTime() >=
          PORTAL_AUTH_POLICY.sessionTouchIntervalMs
        ) {
          await t.session.update({
            where: { id: session.id },
            data: {
              lastSeenAt: at,
              expiresAt: new Date(at.getTime() + PORTAL_AUTH_POLICY.sessionLifetimeMs),
            },
          });
        }
        return { sessionId: session.id, customerAccountId: session.customerAccountId };
      });
    },

    async getProfile(auth: CustomerAuth): Promise<CustomerProfile> {
      return toProfile(await account(auth.customerAccountId));
    },

    async updateProfile(
      auth: CustomerAuth,
      input: UpdateCustomerProfileRequest,
    ): Promise<CustomerProfile> {
      const updated = await tx((t) =>
        t.customerAccount.update({
          where: { id: auth.customerAccountId },
          data: {
            ...(input.name !== undefined && { name: input.name }),
            ...(input.phone !== undefined && { phone: input.phone }),
          },
        }),
      );
      return toProfile(updated);
    },

    /** Requires the current password; other sessions end, this one stays (FSD 5.3). */
    async changePassword(auth: CustomerAuth, input: ChangePasswordRequest): Promise<void> {
      const current = await account(auth.customerAccountId);
      if (!(await passwords.verify(current.passwordHash, input.currentPassword))) {
        throw new AppError({
          status: 400,
          code: 'VALIDATION_FAILED',
          title: 'Wrong password',
          detail: 'Your current password is incorrect.',
          errors: [{ path: 'currentPassword', message: 'Incorrect password.' }],
        });
      }
      if (passwordContainsEmail(input.newPassword, current.email))
        throw passwordContainsEmailError('newPassword');
      const passwordHash = await passwords.hash(input.newPassword);
      await tx(async (t) => {
        await t.customerAccount.update({
          where: { id: current.id },
          data: { passwordHash, passwordChangedAt: now() },
        });
        await t.session.updateMany({
          where: { customerAccountId: current.id, revokedAt: null, id: { not: auth.sessionId } },
          data: { revokedAt: now() },
        });
        await enqueue(t, {
          tenantId: null,
          to: current.email,
          template: 'portal.password_changed',
          payload: { name: current.name },
        });
      });
    },

    async listSessions(auth: CustomerAuth): Promise<SessionList> {
      const rows = await tx((t) =>
        t.session.findMany({
          where: {
            customerAccountId: auth.customerAccountId,
            app: 'portal',
            revokedAt: null,
            expiresAt: { gt: now() },
          },
          orderBy: { lastSeenAt: 'desc' },
        }),
      );
      return {
        items: rows.map((row) => ({
          id: row.id,
          device: describeDevice(row.userAgent ?? undefined),
          createdAt: row.createdAt.toISOString(),
          lastSeenAt: row.lastSeenAt.toISOString(),
          current: row.id === auth.sessionId,
        })),
      };
    },

    /** Revokes one of the customer's own sessions; someone else's answers 404. */
    async revokeSession(auth: CustomerAuth, sessionId: string): Promise<void> {
      const { count } = await tx((t) =>
        t.session.updateMany({
          where: { id: sessionId, customerAccountId: auth.customerAccountId, revokedAt: null },
          data: { revokedAt: now() },
        }),
      );
      if (count === 0) throw notFound('Session');
    },

    async logout(auth: CustomerAuth): Promise<void> {
      await tx((t) =>
        t.session.update({ where: { id: auth.sessionId }, data: { revokedAt: now() } }),
      );
    },

    async logoutAll(auth: CustomerAuth): Promise<void> {
      await tx((t) =>
        t.session.updateMany({
          where: { customerAccountId: auth.customerAccountId, revokedAt: null },
          data: { revokedAt: now() },
        }),
      );
    },
  };
}

export type PortalAuthService = ReturnType<typeof createPortalAuthService>;
