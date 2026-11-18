// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { SignupInput } from '../domain/auth';
import { secondsUntil } from '../domain/auth-rules';
import { useDependencies } from '../../shared/presentation/dependencies';
import { toSessionViewModel, type SessionViewModel } from './session.view-model';

const SESSION_KEY = ['auth', 'session'] as const;

export type SessionState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'signed-in'; view: SessionViewModel }
  | { status: 'error' };

/** Who is logged in. Re-checked when the window regains focus, so a revoked session shows. */
export function useSession(): SessionState {
  const { auth } = useDependencies();
  const { data, status } = useQuery({
    queryKey: SESSION_KEY,
    queryFn: () => auth.getSession(),
    staleTime: 60_000,
    retry: false,
  });
  if (status === 'pending') return { status: 'loading' };
  if (status === 'error') return { status: 'error' };
  return data ? { status: 'signed-in', view: toSessionViewModel(data) } : { status: 'signed-out' };
}

export function useLogin() {
  const { auth } = useDependencies();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      auth.login(email, password),
    onSuccess: async (outcome) => {
      if (outcome.kind === 'signed-in')
        await queryClient.invalidateQueries({ queryKey: SESSION_KEY });
    },
  });
}

export function useSignup() {
  const { auth } = useDependencies();
  return useMutation({ mutationFn: (input: SignupInput) => auth.signup(input) });
}

const subscribeNever = () => () => {};

/**
 * The challenge waiting for a code. It lives in sessionStorage, which only exists in the
 * browser: `ready` turns true after hydration, so the server and first client render agree.
 */
export function usePendingChallenge() {
  const { auth } = useDependencies();
  const ready = useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
  const challenge = useMemo(() => (ready ? auth.pendingChallenge() : null), [ready, auth]);
  return { ready, challenge };
}

export function useVerifyCode() {
  const { auth } = useDependencies();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { challengeId: string; code: string; trustDevice: boolean }) =>
      auth.verifyCode(input.challengeId, input.code, input.trustDevice),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SESSION_KEY }),
  });
}

export function useResendCode() {
  const { auth } = useDependencies();
  return useMutation({ mutationFn: (challengeId: string) => auth.resendCode(challengeId) });
}

export function useLogout() {
  const { auth } = useDependencies();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => auth.logout(),
    onSettled: () => {
      // Forget everything cached for the previous user.
      queryClient.clear();
    },
  });
}

export function useRequestPasswordReset() {
  const { auth } = useDependencies();
  return useMutation({ mutationFn: (email: string) => auth.requestPasswordReset(email) });
}

export function useResetPassword() {
  const { auth } = useDependencies();
  return useMutation({
    mutationFn: ({ token, password }: { token: string; password: string }) =>
      auth.resetPassword(token, password),
  });
}

export function useAbandonLogin() {
  const { auth } = useDependencies();
  return auth.abandonLogin;
}

/** Seconds left until `target`, updated every second; 0 when reached or unknown. */
export function useCountdown(target: Date | null | undefined): number {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!target) return;
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, [target]);
  return target ? secondsUntil(target, now) : 0;
}
