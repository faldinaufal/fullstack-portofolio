// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { RequestError } from '../../shared/domain/request-error';
import { useDependencies } from '../../shared/presentation/dependencies';
import {
  initialsOf,
  stepUpMinutesLeft,
  type Admin,
  type CodeChallenge,
} from '../domain/admin-auth';

export type { Admin, CodeChallenge } from '../domain/admin-auth';

const ME = ['admin', 'me'] as const;

export type AdminSession =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'signed-out' }
  | { status: 'signed-in'; admin: Admin; initials: string };

export function useAdminSession(): AdminSession {
  const { auth } = useDependencies();
  const me = useQuery({ queryKey: ME, queryFn: () => auth.me(), retry: false, staleTime: 30_000 });
  if (me.isPending) return { status: 'loading' };
  if (me.isError) return { status: 'error' };
  if (!me.data) return { status: 'signed-out' };
  return { status: 'signed-in', admin: me.data, initials: initialsOf(me.data.name) };
}

export function useLogin() {
  const { auth } = useDependencies();
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      auth.login(email, password),
  });
}

export function useVerifyLogin() {
  const { auth } = useDependencies();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ challengeId, code }: { challengeId: string; code: string }) =>
      auth.verify(challengeId, code),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ME }),
  });
}

export function useResendCode() {
  const { auth } = useDependencies();
  return useMutation({ mutationFn: (challengeId: string) => auth.resend(challengeId) });
}

export function useLogout() {
  const { auth } = useDependencies();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => auth.logout(),
    onSettled: () => queryClient.setQueryData(ME, null),
  });
}

/** "Code verified, 7 min left" / "Code needed", refreshed every 30 seconds. */
export function useStepUpLabel(admin: Admin): { fresh: boolean; label: string } {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);
  const left = stepUpMinutesLeft(admin, now);
  return left > 0
    ? { fresh: true, label: `Code verified · ${left} min left` }
    : { fresh: false, label: 'New code needed for changes' };
}

/**
 * Runs a sensitive action; when the API answers `STEP_UP_REQUIRED` (FSD 6.11) it emails a
 * code, lets the screen ask for it, and runs the action again once it is verified.
 */
export function useStepUp() {
  const { auth } = useDependencies();
  const queryClient = useQueryClient();
  const pending = useRef<(() => Promise<unknown>) | null>(null);
  const [challenge, setChallenge] = useState<CodeChallenge | null>(null);
  const start = useMutation({ mutationFn: () => auth.startStepUp() });
  const verify = useMutation({
    mutationFn: ({ code }: { code: string }) => auth.verifyStepUp(challenge!.id, code),
    onSuccess: async (admin) => {
      queryClient.setQueryData(ME, admin);
      setChallenge(null);
      const retry = pending.current;
      pending.current = null;
      await retry?.();
    },
  });

  const run = useCallback(
    async (action: () => Promise<unknown>) => {
      try {
        await action();
      } catch (error) {
        if (!(error instanceof RequestError) || error.code !== 'STEP_UP_REQUIRED') throw error;
        pending.current = action;
        setChallenge(await start.mutateAsync());
      }
    },
    [start],
  );

  return {
    run,
    /** Set while the screen should ask for the code. */
    challenge,
    verify,
    cancel: () => {
      pending.current = null;
      setChallenge(null);
      verify.reset();
    },
  };
}
