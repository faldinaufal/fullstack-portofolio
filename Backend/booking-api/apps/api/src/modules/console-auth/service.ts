// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import {
  passwordContainsEmail,
  type ConsoleLoginRequest,
  type ConsoleLoginResponse,
  type ConsoleMeResponse,
  type ConsoleMembership,
  type ConsoleSignupRequest,
  type ForgotPasswordRequest,
  type OtpChallenge,
  type ResendOtpRequest,
  type ResetPasswordRequest,
  type VerifyOtpRequest,
} from '@tempora/contracts';
import { Prisma, setDbContext, withDbContext, type PrismaClient, type Tx } from '@tempora/db';
import { AppError } from '../../lib/app-error.js';
import type { PasswordHasher } from '../../lib/passwords.js';
import { RATE_LIMITS, type RateLimiter } from '../../lib/rate-limit.js';
import { generateOtpCode, generateToken, safeEqual, type TokenHasher } from '../../lib/tokens.js';
import { describeDevice, maskEmail } from '../../lib/user-agent.js';
import { uuidv7 } from '../../lib/uuid.js';
import {
  addMs,
  CONSOLE_AUTH_POLICY as POLICY,
  isChallengeUsable,
  isSessionActive,
  isTrustedDeviceValid,
  pickMembership,
  shouldTouchSession,
} from './policy.js';
import { consoleAuthRepository as repo } from './repository.js';

export interface RequestMeta {
  ip: string;
  userAgent: string | undefined;
}

/** A secret the routes put into a cookie. */
export interface IssuedToken {
  token: string;
  expiresAt: Date;
}

/** The signed-in Console user, attached to every authenticated request. */
export interface ConsoleAuth {
  sessionId: string;
  teamAccountId: string;
  membershipId: string;
  tenantId: string;
  role: 'owner' | 'manager' | 'staff';
  branchId: string | null;
}

export interface ConsoleAuthServiceDeps {
  prisma: PrismaClient;
  passwords: PasswordHasher;
  hashToken: TokenHasher;
  rateLimiter: RateLimiter;
  /** Console origin, for links in emails. */
  consoleUrl: string;
  now?: () => Date;
}

const INVALID_CREDENTIALS = () =>
  new AppError({
    status: 401,
    code: 'INVALID_CREDENTIALS',
    title: 'Wrong email or password',
    detail: 'The email or password is incorrect.',
  });

const CODE_EXPIRED = () =>
  new AppError({
    status: 410,
    code: 'CODE_EXPIRED',
    title: 'Code no longer valid',
    detail: 'This code has expired or was used too many times. Log in again to get a new one.',
  });

const TOKEN_INVALID = () =>
  new AppError({
    status: 410,
    code: 'TOKEN_INVALID',
    title: 'Link no longer valid',
    detail: 'This link is invalid, was already used or has expired. Request a new one.',
  });

const NO_ACTIVE_BUSINESS = () =>
  new AppError({
    status: 403,
    code: 'FORBIDDEN',
    title: 'No active business',
    detail: 'This account is not an active member of any business.',
  });

const PASSWORD_CONTAINS_EMAIL = () =>
  new AppError({
    status: 400,
    code: 'VALIDATION_FAILED',
    title: 'Invalid request',
    detail: 'The password must not contain your email address.',
    errors: [{ path: 'password', message: 'Must not contain your email address.' }],
  });

function toMembershipDto(membership: {
  id: string;
  role: ConsoleMembership['role'];
  branchId: string | null;
  tenant: ConsoleMembership['tenant'];
}): ConsoleMembership {
  return {
    id: membership.id,
    role: membership.role,
    branchId: membership.branchId,
    tenant: membership.tenant,
  };
}

export function createConsoleAuthService({
  prisma,
  passwords,
  hashToken,
  rateLimiter,
  consoleUrl,
  now = () => new Date(),
}: ConsoleAuthServiceDeps) {
  /** Creates a code challenge and queues the email, inside the caller's transaction. */
  async function issueLoginCode(
    tx: Tx,
    account: { id: string; email: string; name: string },
    ip: string,
  ): Promise<OtpChallenge> {
    const at = now();
    const id = uuidv7(at);
    const code = generateOtpCode();
    const expiresAt = addMs(at, POLICY.otpTtlMs);

    await repo.createLoginChallenge(tx, {
      id,
      teamAccountId: account.id,
      codeHash: hashToken(`otp:${id}`, code),
      expiresAt,
      now: at,
      ip,
    });
    await repo.enqueueEmail(tx, {
      tenantId: null,
      to: account.email,
      template: 'console.login_code',
      payload: { name: account.name, code, expiresInMinutes: POLICY.otpTtlMs / 60_000 },
    });

    return {
      status: 'otp_required',
      challengeId: id,
      sentTo: maskEmail(account.email),
      expiresAt: expiresAt.toISOString(),
      resendAvailableAt: addMs(at, POLICY.otpResendCooldownMs).toISOString(),
    };
  }

  /** Opens a session bound to the last used (or oldest) active membership. */
  async function startSession(tx: Tx, teamAccountId: string, meta: RequestMeta) {
    const memberships = await repo.listActiveMemberships(tx, teamAccountId);
    const membership = pickMembership(
      memberships,
      await repo.lastUsedMembershipId(tx, teamAccountId),
    );
    if (!membership) throw NO_ACTIVE_BUSINESS();

    const at = now();
    const token = generateToken();
    const expiresAt = addMs(at, POLICY.sessionMaxMs);
    await repo.createConsoleSession(tx, {
      tokenHash: hashToken('session', token),
      teamAccountId,
      membershipId: membership.id,
      now: at,
      expiresAt,
      ip: meta.ip,
      userAgent: meta.userAgent?.slice(0, 300) ?? null,
    });
    return { token, expiresAt } satisfies IssuedToken;
  }

  return {
    /**
     * FSD 3.4 step 1: team account + tenant + owner membership in one transaction, then the
     * same email code as a login. The code proves the address, so no separate verification
     * link is needed.
     */
    async signup(input: ConsoleSignupRequest, meta: RequestMeta): Promise<OtpChallenge> {
      await rateLimiter.assertAllowed(RATE_LIMITS.consoleSignup, meta.ip);
      if (passwordContainsEmail(input.password, input.email)) throw PASSWORD_CONTAINS_EMAIL();
      await rateLimiter.record(RATE_LIMITS.consoleSignup, meta.ip);

      // Hashing is slow on purpose; do it before opening the transaction.
      const passwordHash = await passwords.hash(input.password);

      try {
        return await withDbContext(prisma, {}, async (tx) => {
          if (await repo.findAccountByEmail(tx, input.email)) throw emailTaken();
          if (await repo.slugExists(tx, input.slug)) throw slugTaken();

          const account = await repo.createAccount(tx, {
            email: input.email,
            name: input.name,
            passwordHash,
          });
          const tenant = await repo.createTenant(tx, {
            slug: input.slug,
            name: input.businessName,
          });
          // The membership is tenant-owned: switch the RLS context to the new tenant.
          await setDbContext(tx, { tenantId: tenant.id, teamAccountId: account.id });
          await repo.createOwnerMembership(tx, { tenantId: tenant.id, teamAccountId: account.id });

          return issueLoginCode(tx, account, meta.ip);
        });
      } catch (error) {
        // Two sign-ups racing for the same email or slug: the unique index decides.
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          const taken = await withDbContext(prisma, {}, (tx) => repo.slugExists(tx, input.slug));
          throw taken ? slugTaken() : emailTaken();
        }
        throw error;
      }
    },

    /**
     * Password check, then either a session (trusted device) or an emailed code.
     * Wrong email and wrong password produce the same error and take the same time.
     */
    async login(
      input: ConsoleLoginRequest,
      meta: RequestMeta,
      deviceToken: string | undefined,
    ): Promise<{ response: ConsoleLoginResponse; session?: IssuedToken }> {
      const limitKey = `${input.email}\n${meta.ip}`;
      await rateLimiter.assertAllowed(RATE_LIMITS.consoleLoginFailure, limitKey);

      const account = await withDbContext(prisma, {}, (tx) =>
        repo.findAccountByEmail(tx, input.email),
      );
      const passwordOk = account
        ? await passwords.verify(account.passwordHash, input.password)
        : (await passwords.burnTime(input.password), false);
      if (!account || !passwordOk) {
        await rateLimiter.record(RATE_LIMITS.consoleLoginFailure, limitKey);
        throw INVALID_CREDENTIALS();
      }

      return withDbContext(prisma, { teamAccountId: account.id }, async (tx) => {
        const memberships = await repo.listActiveMemberships(tx, account.id);
        if (memberships.length === 0) throw NO_ACTIVE_BUSINESS();

        if (deviceToken) {
          const device = await repo.findTrustedDevice(
            tx,
            account.id,
            hashToken('trusted-device', deviceToken),
          );
          if (device && isTrustedDeviceValid(device, account.passwordChangedAt, now())) {
            await repo.touchTrustedDevice(tx, device.id, now());
            const session = await startSession(tx, account.id, meta);
            return { response: { status: 'authenticated' }, session };
          }
        }

        return { response: await issueLoginCode(tx, account, meta.ip) };
      });
    },

    /** Completes a login: correct code → session (and optionally a trusted device). */
    async verifyOtp(
      input: Required<VerifyOtpRequest>,
      meta: RequestMeta,
    ): Promise<{ session: IssuedToken; device?: IssuedToken }> {
      const challenge = await withDbContext(prisma, {}, (tx) =>
        repo.findLoginChallenge(tx, input.challengeId),
      );
      if (!challenge?.teamAccountId || !isChallengeUsable(challenge, now())) throw CODE_EXPIRED();
      const teamAccountId = challenge.teamAccountId;

      if (!safeEqual(challenge.codeHash, hashToken(`otp:${challenge.id}`, input.code))) {
        // Counted in its own transaction, so the attempt sticks although we return an error.
        const attempts = await withDbContext(prisma, {}, (tx) =>
          repo.recordWrongCode(tx, challenge.id, POLICY.otpMaxAttempts),
        );
        const left = POLICY.otpMaxAttempts - (attempts ?? POLICY.otpMaxAttempts);
        if (left <= 0) throw CODE_EXPIRED();
        throw new AppError({
          status: 401,
          code: 'CODE_INVALID',
          title: 'Wrong code',
          detail: `The code is incorrect. ${left} ${left === 1 ? 'attempt' : 'attempts'} left.`,
        });
      }

      return withDbContext(prisma, { teamAccountId }, async (tx) => {
        if (!(await repo.consumeChallenge(tx, challenge.id, now()))) throw CODE_EXPIRED();
        await repo.markEmailVerified(tx, teamAccountId, now());
        const session = await startSession(tx, teamAccountId, meta);

        if (!input.trustDevice) return { session };
        const token = generateToken();
        const expiresAt = addMs(now(), POLICY.trustedDeviceTtlMs);
        await repo.createTrustedDevice(tx, {
          teamAccountId,
          tokenHash: hashToken('trusted-device', token),
          label: describeDevice(meta.userAgent),
          now: now(),
          expiresAt,
        });
        return { session, device: { token, expiresAt } };
      });
    },

    /** New code for the same challenge: once a minute and 5 times per 15 minutes. */
    async resendOtp(input: ResendOtpRequest): Promise<OtpChallenge> {
      return withDbContext(prisma, {}, async (tx) => {
        const challenge = await repo.findLoginChallenge(tx, input.challengeId);
        if (!challenge?.teamAccountId || !isChallengeUsable(challenge, now())) throw CODE_EXPIRED();

        const nextAllowed = addMs(challenge.lastSentAt, POLICY.otpResendCooldownMs);
        if (nextAllowed > now()) {
          const seconds = Math.ceil((nextAllowed.getTime() - now().getTime()) / 1000);
          throw new AppError({
            status: 429,
            code: 'RATE_LIMITED',
            title: 'Too many requests',
            detail: `You can request a new code in ${seconds} seconds.`,
          });
        }
        await rateLimiter.assertAllowed(RATE_LIMITS.consoleOtpResend, challenge.teamAccountId);
        await rateLimiter.record(RATE_LIMITS.consoleOtpResend, challenge.teamAccountId);

        const account = await repo.findAccountById(tx, challenge.teamAccountId);
        if (!account) throw CODE_EXPIRED();

        const at = now();
        const code = generateOtpCode();
        const expiresAt = addMs(at, POLICY.otpTtlMs);
        await repo.replaceChallengeCode(tx, challenge.id, {
          codeHash: hashToken(`otp:${challenge.id}`, code),
          now: at,
          expiresAt,
        });
        await repo.enqueueEmail(tx, {
          tenantId: null,
          to: account.email,
          template: 'console.login_code',
          payload: { name: account.name, code, expiresInMinutes: POLICY.otpTtlMs / 60_000 },
        });
        return {
          status: 'otp_required',
          challengeId: challenge.id,
          sentTo: maskEmail(account.email),
          expiresAt: expiresAt.toISOString(),
          resendAvailableAt: addMs(at, POLICY.otpResendCooldownMs).toISOString(),
        };
      });
    },

    async logout(auth: ConsoleAuth): Promise<void> {
      await withDbContext(prisma, {}, (tx) => repo.revokeSession(tx, auth.sessionId, now()));
    },

    async logoutAll(auth: ConsoleAuth): Promise<void> {
      await withDbContext(prisma, {}, (tx) =>
        repo.revokeAllSessions(tx, auth.teamAccountId, now()),
      );
    },

    /** Same answer whether or not the email exists (no account enumeration). */
    async forgotPassword(input: ForgotPasswordRequest, meta: RequestMeta): Promise<void> {
      const limitKey = `${input.email}\n${meta.ip}`;
      await rateLimiter.assertAllowed(RATE_LIMITS.consolePasswordReset, limitKey);
      await rateLimiter.record(RATE_LIMITS.consolePasswordReset, limitKey);

      await withDbContext(prisma, {}, async (tx) => {
        const account = await repo.findAccountByEmail(tx, input.email);
        if (!account) return;

        const token = generateToken();
        const at = now();
        await repo.createPasswordResetToken(tx, {
          teamAccountId: account.id,
          tokenHash: hashToken('password-reset', token),
          now: at,
          expiresAt: addMs(at, POLICY.passwordResetTtlMs),
        });
        const resetUrl = new URL('/reset-password', consoleUrl);
        resetUrl.searchParams.set('token', token);
        await repo.enqueueEmail(tx, {
          tenantId: null,
          to: account.email,
          template: 'console.password_reset',
          payload: {
            name: account.name,
            resetUrl: resetUrl.toString(),
            expiresInMinutes: POLICY.passwordResetTtlMs / 60_000,
          },
        });
      });
    },

    /**
     * New password from an emailed link. Ends every session and trusted device, so the next
     * login always asks for a code (FSD 6.11), and tells the owner of the address.
     */
    async resetPassword(input: ResetPasswordRequest): Promise<void> {
      const found = await withDbContext(prisma, {}, async (tx) => {
        const token = await repo.findPasswordResetToken(
          tx,
          hashToken('password-reset', input.token),
        );
        if (!token?.teamAccountId || token.usedAt || token.expiresAt <= now()) return null;
        const account = await repo.findAccountById(tx, token.teamAccountId);
        return account ? { token, account } : null;
      });
      if (!found) throw TOKEN_INVALID();
      if (passwordContainsEmail(input.password, found.account.email))
        throw PASSWORD_CONTAINS_EMAIL();

      const passwordHash = await passwords.hash(input.password);

      await withDbContext(prisma, {}, async (tx) => {
        if (!(await repo.useToken(tx, found.token.id, now()))) throw TOKEN_INVALID();
        await repo.updatePassword(tx, found.account.id, passwordHash, now());
        await repo.revokeAllSessions(tx, found.account.id, now());
        await repo.revokeAllTrustedDevices(tx, found.account.id, now());
        await repo.enqueueEmail(tx, {
          tenantId: null,
          to: found.account.email,
          template: 'console.password_changed',
          payload: { name: found.account.name },
        });
      });
    },

    /**
     * Resolves the session cookie on every request. Returns null for anything that is not a
     * live Console session of an active membership; revocation therefore takes effect on the
     * very next request (PRD requirement).
     */
    async authenticate(sessionToken: string): Promise<ConsoleAuth | null> {
      const at = now();
      return withDbContext(prisma, {}, async (tx) => {
        const session = await repo.findConsoleSession(tx, hashToken('session', sessionToken));
        if (!session?.teamAccountId || !session.membershipId || !isSessionActive(session, at)) {
          return null;
        }
        const teamAccountId = session.teamAccountId;
        await setDbContext(tx, { teamAccountId });
        const membership = (await repo.listActiveMemberships(tx, teamAccountId)).find(
          (candidate) => candidate.id === session.membershipId,
        );
        if (!membership) return null;

        if (shouldTouchSession(session.lastSeenAt, at)) await repo.touchSession(tx, session.id, at);
        return {
          sessionId: session.id,
          teamAccountId,
          membershipId: membership.id,
          tenantId: membership.tenantId,
          role: membership.role,
          branchId: membership.branchId,
        };
      });
    },

    async getMe(auth: ConsoleAuth): Promise<ConsoleMeResponse> {
      return withDbContext(prisma, { teamAccountId: auth.teamAccountId }, async (tx) => {
        const account = await repo.findAccountById(tx, auth.teamAccountId);
        const memberships = await repo.listActiveMemberships(tx, auth.teamAccountId);
        const active = memberships.find((membership) => membership.id === auth.membershipId);
        if (!account || !active) {
          throw new AppError({ status: 401, code: 'UNAUTHENTICATED', title: 'Session ended' });
        }
        return {
          account: { id: account.id, email: account.email, name: account.name },
          activeMembership: toMembershipDto(active),
          memberships: memberships.map(toMembershipDto),
        };
      });
    },
  };
}

function emailTaken() {
  return new AppError({
    status: 409,
    code: 'EMAIL_TAKEN',
    title: 'Email already registered',
    detail: 'An account with this email already exists. Log in instead.',
    errors: [{ path: 'email', message: 'Already registered.' }],
  });
}

function slugTaken() {
  return new AppError({
    status: 409,
    code: 'SLUG_TAKEN',
    title: 'Address already taken',
    detail: 'Another business already uses this address.',
    errors: [{ path: 'slug', message: 'Already taken.' }],
  });
}

export type ConsoleAuthService = ReturnType<typeof createConsoleAuthService>;
