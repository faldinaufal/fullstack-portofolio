// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Customer, SignupInput } from '../domain/account';
import { useDependencies } from '../../shared/presentation/dependencies';

const CUSTOMER = ['account', 'customer'] as const;
const SESSIONS = ['account', 'sessions'] as const;

const lastSeen = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

/** The signed-in customer (null for a visitor). */
export function useCustomer() {
  const { account } = useDependencies();
  return useQuery({
    queryKey: CUSTOMER,
    queryFn: () => account.getCustomer(),
    retry: false,
    staleTime: 60_000,
  });
}

/** Mutations that log someone in or out replace the cached customer. */
function useSessionChange<TInput>(run: (input: TInput) => Promise<Customer | null>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: (customer) => {
      queryClient.setQueryData(CUSTOMER, customer);
      void queryClient.invalidateQueries({ queryKey: SESSIONS });
    },
  });
}

export function useSignup() {
  const { account } = useDependencies();
  return useSessionChange((input: SignupInput) => account.signup(input));
}

export function useLogin() {
  const { account } = useDependencies();
  return useSessionChange(({ email, password }: { email: string; password: string }) =>
    account.login(email, password),
  );
}

export function useLogout() {
  const { account } = useDependencies();
  return useSessionChange(async () => {
    await account.logout();
    return null;
  });
}

export function useLogoutEverywhere() {
  const { account } = useDependencies();
  return useSessionChange(async () => {
    await account.logoutEverywhere();
    return null;
  });
}

export function useVerifyEmail() {
  const { account } = useDependencies();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (token: string) => account.verifyEmail(token),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CUSTOMER }),
  });
}

export function useResendVerification() {
  const { account } = useDependencies();
  return useMutation({ mutationFn: () => account.resendVerification() });
}

export function useRequestPasswordReset() {
  const { account } = useDependencies();
  return useMutation({ mutationFn: (email: string) => account.requestPasswordReset(email) });
}

export function useResetPassword() {
  const { account } = useDependencies();
  return useMutation({
    mutationFn: ({ token, password }: { token: string; password: string }) =>
      account.resetPassword(token, password),
  });
}

export function useUpdateProfile() {
  const { account } = useDependencies();
  return useSessionChange((input: { name?: string; phone?: string | null }) =>
    account.updateProfile(input),
  );
}

export function useChangePassword() {
  const { account } = useDependencies();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      currentPassword,
      newPassword,
    }: {
      currentPassword: string;
      newPassword: string;
    }) => account.changePassword(currentPassword, newPassword),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SESSIONS }),
  });
}

export function useSessions() {
  const { account } = useDependencies();
  return useQuery({
    queryKey: SESSIONS,
    queryFn: () => account.listSessions(),
    select: (sessions) =>
      sessions.map((session) => ({
        ...session,
        detail: session.current
          ? 'This device'
          : `Last active ${lastSeen.format(session.lastSeenAt)}`,
      })),
  });
}

export function useRevokeSession() {
  const { account } = useDependencies();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => account.revokeSession(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SESSIONS }),
  });
}

export { PASSWORD_MIN_LENGTH, signupProblems, type Customer } from '../domain/account';
