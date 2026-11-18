// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { BranchDetail, BranchInput, Closure, OpeningHours } from '../domain/branch';
import { summarizeOpeningHours } from '../domain/opening-hours';
import { useDependencies } from '../../shared/presentation/dependencies';

const KEY = ['branches'] as const;
const detailKey = (id: string) => ['branches', id] as const;

export interface BranchRow {
  id: string;
  name: string;
  contact: string;
  members: string;
  archived: boolean;
}

export function useBranches() {
  const { branches } = useDependencies();
  return useQuery({
    queryKey: KEY,
    queryFn: () => branches.list(),
    select: (items): BranchRow[] =>
      items.map((branch) => ({
        id: branch.id,
        name: branch.name,
        contact: [branch.address, branch.phone].filter(Boolean).join(' · ') || 'No address yet',
        members: `${branch.activeMembers} ${branch.activeMembers === 1 ? 'member' : 'members'}`,
        archived: branch.archived,
      })),
  });
}

export function useBranch(id: string) {
  const { branches } = useDependencies();
  return useQuery({
    queryKey: detailKey(id),
    queryFn: () => branches.get(id),
    select: (branch) => ({ ...branch, hoursSummary: summarizeOpeningHours(branch.openingHours) }),
  });
}

/** After any change: the detail gets the server's answer, the list is refetched. */
function useBranchMutation<TInput>(run: (input: TInput) => Promise<BranchDetail>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: async (branch) => {
      queryClient.setQueryData(detailKey(branch.id), branch);
      await queryClient.invalidateQueries({ queryKey: KEY, exact: true });
    },
  });
}

export function useCreateBranch() {
  const { branches } = useDependencies();
  return useBranchMutation((input: BranchInput) => branches.create(input));
}

export function useUpdateBranch(id: string) {
  const { branches } = useDependencies();
  return useBranchMutation(({ version, input }: { version: number; input: BranchInput }) =>
    branches.update(id, version, input),
  );
}

export function useArchiveBranch(id: string) {
  const { branches } = useDependencies();
  return useBranchMutation(() => branches.archive(id));
}

export function useReplaceOpeningHours(id: string) {
  const { branches } = useDependencies();
  return useBranchMutation((hours: OpeningHours[]) => branches.replaceOpeningHours(id, hours));
}

export function useAddClosure(id: string) {
  const { branches } = useDependencies();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (closure: Omit<Closure, 'id'>) => branches.addClosure(id, closure),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: detailKey(id) }),
  });
}

export function useRemoveClosure(id: string) {
  const { branches } = useDependencies();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (closureId: string) => branches.removeClosure(id, closureId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: detailKey(id) }),
  });
}

export { openingHoursProblems, WEEK_ORDER, WEEKDAYS } from '../domain/opening-hours';
