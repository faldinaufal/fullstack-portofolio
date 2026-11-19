// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type {
  AdminCodeRequest,
  AdminLoginRequest,
  AdminMe,
  OtpChallenge,
} from '@tempora/contracts';
import { withDbContext, type PrismaClient, type Tx } from '@tempora/db';
import { AppError } from '../../lib/app-error.js';
import type { PasswordHasher } from '../../lib/passwords.js';
import { RATE_LIMITS, type RateLimiter } from '../../lib/rate-limit.js';
import { generateOtpCode, generateToken, safeEqual, type TokenHasher } from '../../lib/tokens.js';
import { maskEmail } from '../../lib/user-agent.js';
import { uuidv7 } from '../../lib/uuid.js';
import {
  ADMIN_AUTH_POLICY as POLICY,
  isAdminSessionActive,
  isCodeUsable,
  stepUpValidUntil,
} from './policy.js';

export interface RequestMeta {
  ip: string;
  userAgent: string | undefined;
}

/** The signed-in platform admin, attached to every authenticated `/v1/admin` request. */
export interface AdminAuth {
  sessionId: string;
  adminId: string;
  name: string;
  email: string;
  stepUpAt: Date | null;
}

export interface AdminAuthServiceDeps {
  prisma: PrismaClient;
  passwords: PasswordHasher;
  hashToken: TokenHasher;
  rateLimiter: RateLimiter;
  now?: () => Date;
}

const addMs = (date: Date, ms: number) => new Date(date.getTime() + ms);
const RESEND_SENT_TO = 'your email address';

/**
 * One answer for every wrong or unknown code: no "attempts left", no difference between a
 * real challenge and the decoy a wrong password gets (FSD 5.5), so the code step cannot be
 * used to learn whether a password was right.
 */
const codeRejected = () =>
  new AppError({
    status: 401,
    code: 'CODE_INVALID',
    title: 'Code not accepted',
    detail: 'The code is wrong or no longer valid. Check the latest email, or log in again.',
  });

export const stepUpRequired = () =>
  new AppError({
    status: 403,
    code: 'STEP_UP_REQUIRED',
    title: 'Confirm it is you',
    detail: 'Enter a new code from your email to continue.',
  });

/** Platform Admin login with an emailed code, sessions and step-up (FSD 5.5, 6.11). */
export function createAdminAuthService({
  prisma,
  passwords,
  hashToken,
  rateLimiter,
  now = () => new Date(),
}: AdminAuthServiceDeps) {
  const db = <T>(work: (tx: Tx) => Promise<T>) => withDbContext(prisma, {}, work);

  /**
   * The challenge answer, the same whether a code was really sent or not. `sentTo` is the
   * address that was typed (login), or a generic phrase when only the challenge is known
   * (resend), so a decoy never looks different from a real challenge.
   */
  const answer = (id: string, sentTo: string, at: Date): OtpChallenge => ({
    status: 'otp_required',
    challengeId: id,
    sentTo,
    expiresAt: addMs(at, POLICY.otpTtlMs).toISOString(),
    resendAvailableAt: addMs(at, POLICY.otpResendCooldownMs).toISOString(),
  });

  async function sendCode(
    tx: Tx,
    admin: { id: string; email: string; name: string },
    data: { purpose: 'login' | 'step_up'; sessionId: string | null; ip: string },
  ): Promise<OtpChallenge> {
    const at = now();
    const id = uuidv7(at);
    const code = generateOtpCode();
    await tx.otpChallenge.create({
      data: {
        id,
        purpose: data.purpose,
        platformAdminId: admin.id,
        sessionId: data.sessionId,
        codeHash: hashToken(`otp:${id}`, code),
        expiresAt: addMs(at, POLICY.otpTtlMs),
        createdAt: at,
        lastSentAt: at,
        ip: data.ip,
      },
    });
    await tx.emailMessage.createMany({
      // Account emails may be written but not read back (FSD 4.4): no RETURNING.
      data: [
        {
          tenantId: null,
          toEmail: admin.email,
          template: 'admin.login_code',
          payload: { name: admin.name, code, expiresInMinutes: POLICY.otpTtlMs / 60_000 },
        },
      ],
    });
    return answer(id, maskEmail(admin.email), at);
  }

  /** Checks a code; counts a wrong one. Returns the challenge when right. */
  async function checkCode(input: AdminCodeRequest, purpose: 'login' | 'step_up') {
    const challenge = await db((tx) =>
      tx.otpChallenge.findFirst({
        where: { id: input.challengeId, purpose, platformAdminId: { not: null } },
      }),
    );
    if (!challenge || !isCodeUsable(challenge, now())) throw codeRejected();
    if (!safeEqual(challenge.codeHash, hashToken(`otp:${challenge.id}`, input.code))) {
      await db((tx) =>
        tx.otpChallenge.updateMany({
          where: { id: challenge.id, consumedAt: null },
          data: { attempts: { increment: 1 } },
        }),
      );
      throw codeRejected();
    }
    return challenge;
  }

  return {
    /**
     * Always answers with a challenge (FSD 5.5). Only a right password sends a code; a wrong
     * one gets a decoy challenge that no code will ever open, and counts towards the limit.
     */
    async login(input: AdminLoginRequest, meta: RequestMeta): Promise<OtpChallenge> {
      const limitKey = `${input.email}\n${meta.ip}`;
      await rateLimiter.assertAllowed(RATE_LIMITS.adminLoginFailure, limitKey);
      const admin = await db((tx) =>
        tx.platformAdmin.findUnique({ where: { email: input.email } }),
      );
      const passwordOk =
        admin && !admin.disabledAt
          ? await passwords.verify(admin.passwordHash, input.password)
          : (await passwords.burnTime(input.password), false);
      if (!admin || !passwordOk) {
        await rateLimiter.record(RATE_LIMITS.adminLoginFailure, limitKey);
        return answer(uuidv7(now()), maskEmail(input.email), now());
      }
      return db((tx) => sendCode(tx, admin, { purpose: 'login', sessionId: null, ip: meta.ip }));
    },

    async verifyLogin(input: AdminCodeRequest, meta: RequestMeta) {
      const challenge = await checkCode(input, 'login');
      return db(async (tx) => {
        const { count } = await tx.otpChallenge.updateMany({
          where: { id: challenge.id, consumedAt: null },
          data: { consumedAt: now() },
        });
        const admin = await tx.platformAdmin.findUnique({
          where: { id: challenge.platformAdminId! },
        });
        if (count !== 1 || !admin || admin.disabledAt) throw codeRejected();
        const token = generateToken();
        const at = now();
        const expiresAt = addMs(at, POLICY.sessionMaxMs);
        await tx.session.create({
          data: {
            app: 'admin',
            platformAdminId: admin.id,
            tokenHash: hashToken('session', token),
            createdAt: at,
            lastSeenAt: at,
            // Logging in proves the code just now: sensitive actions work for 10 minutes.
            stepUpAt: at,
            expiresAt,
            ip: meta.ip,
            userAgent: meta.userAgent?.slice(0, 300) ?? null,
          },
        });
        return { token, expiresAt };
      });
    },

    /** A new code for the same challenge, at most once a minute. Decoys answer the same way. */
    async resend(challengeId: string): Promise<OtpChallenge> {
      return db(async (tx) => {
        const challenge = await tx.otpChallenge.findFirst({
          where: { id: challengeId, platformAdminId: { not: null } },
          include: { platformAdmin: true },
        });
        const at = now();
        if (!challenge?.platformAdmin || !isCodeUsable(challenge, at)) {
          return answer(challengeId, RESEND_SENT_TO, at);
        }
        if (addMs(challenge.lastSentAt, POLICY.otpResendCooldownMs) > at) {
          throw new AppError({
            status: 429,
            code: 'RATE_LIMITED',
            title: 'Too many requests',
            detail: 'Wait a minute before asking for another code.',
          });
        }
        const code = generateOtpCode();
        await tx.otpChallenge.update({
          where: { id: challenge.id },
          data: {
            codeHash: hashToken(`otp:${challenge.id}`, code),
            lastSentAt: at,
            expiresAt: addMs(at, POLICY.otpTtlMs),
          },
        });
        await tx.emailMessage.createMany({
          // Account emails may be written but not read back (FSD 4.4): no RETURNING.
          data: [
            {
              tenantId: null,
              toEmail: challenge.platformAdmin.email,
              template: 'admin.login_code',
              payload: {
                name: challenge.platformAdmin.name,
                code,
                expiresInMinutes: POLICY.otpTtlMs / 60_000,
              },
            },
          ],
        });
        return answer(challenge.id, RESEND_SENT_TO, at);
      });
    },

    /** The admin of a session cookie, or null (expired, idle, revoked or disabled). */
    async authenticate(token: string): Promise<AdminAuth | null> {
      const at = now();
      return db(async (tx) => {
        const session = await tx.session.findUnique({
          where: { tokenHash: hashToken('session', token) },
          include: { platformAdmin: true },
        });
        if (
          session?.app !== 'admin' ||
          !session.platformAdmin ||
          session.platformAdmin.disabledAt ||
          !isAdminSessionActive(session, at)
        ) {
          return null;
        }
        if (at.getTime() - session.lastSeenAt.getTime() >= POLICY.sessionTouchIntervalMs) {
          await tx.session.update({ where: { id: session.id }, data: { lastSeenAt: at } });
        }
        return {
          sessionId: session.id,
          adminId: session.platformAdmin.id,
          name: session.platformAdmin.name,
          email: session.platformAdmin.email,
          stepUpAt: session.stepUpAt,
        };
      });
    },

    me: (auth: AdminAuth): AdminMe => ({
      id: auth.adminId,
      email: auth.email,
      name: auth.name,
      stepUpValidUntil: stepUpValidUntil(auth.stepUpAt, now())?.toISOString() ?? null,
    }),

    /** FSD 6.11: sensitive actions need a code verified in the last 10 minutes. */
    assertFreshStepUp(auth: AdminAuth): void {
      if (!stepUpValidUntil(auth.stepUpAt, now())) throw stepUpRequired();
    },

    async startStepUp(auth: AdminAuth, meta: RequestMeta): Promise<OtpChallenge> {
      return db(async (tx) => {
        const admin = await tx.platformAdmin.findUniqueOrThrow({ where: { id: auth.adminId } });
        return sendCode(tx, admin, { purpose: 'step_up', sessionId: auth.sessionId, ip: meta.ip });
      });
    },

    /** The code re-verifies this session only (a code for another session is rejected). */
    async verifyStepUp(auth: AdminAuth, input: AdminCodeRequest): Promise<AdminMe> {
      const challenge = await checkCode(input, 'step_up');
      if (challenge.sessionId !== auth.sessionId) throw codeRejected();
      const at = now();
      await db(async (tx) => {
        const { count } = await tx.otpChallenge.updateMany({
          where: { id: challenge.id, consumedAt: null },
          data: { consumedAt: at },
        });
        if (count !== 1) throw codeRejected();
        await tx.session.update({ where: { id: auth.sessionId }, data: { stepUpAt: at } });
      });
      return {
        id: auth.adminId,
        email: auth.email,
        name: auth.name,
        stepUpValidUntil: addMs(at, POLICY.stepUpTtlMs).toISOString(),
      };
    },

    async logout(auth: AdminAuth): Promise<void> {
      await db((tx) =>
        tx.session.updateMany({
          where: { id: auth.sessionId, revokedAt: null },
          data: { revokedAt: now() },
        }),
      );
    },
  };
}

export type AdminAuthService = ReturnType<typeof createAdminAuthService>;
