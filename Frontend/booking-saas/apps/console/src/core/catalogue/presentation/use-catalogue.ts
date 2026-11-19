// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { BookingSettings, Service, ServiceInput } from '../domain/catalogue';
import { formatDollars } from '../domain/catalogue';
import { useDependencies } from '../../shared/presentation/dependencies';

const SETTINGS = ['catalogue', 'settings'] as const;
const SERVICES = ['catalogue', 'services'] as const;

export interface ServiceRow extends Service {
  price: string;
  /** "60 min + 15 min buffer" */
  timing: string;
  therapistsLabel: string;
}

export function toServiceRow(service: Service): ServiceRow {
  return {
    ...service,
    price: formatDollars(service.priceCents),
    timing:
      service.bufferMinutes > 0
        ? `${service.durationMinutes} min + ${service.bufferMinutes} min buffer`
        : `${service.durationMinutes} min`,
    therapistsLabel:
      service.therapists === 0
        ? 'No therapist yet'
        : `${service.therapists} ${service.therapists === 1 ? 'therapist' : 'therapists'}`,
  };
}

/** Business settings and setup status (owner and managers). */
export function useBusinessSettings(enabled = true) {
  const { catalogue } = useDependencies();
  return useQuery({ queryKey: SETTINGS, queryFn: () => catalogue.getSettings(), enabled });
}

export function useUpdateBusinessSettings() {
  const { catalogue } = useDependencies();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      version,
      input,
    }: {
      version: number;
      input: { name?: string; bookingSettings?: Partial<BookingSettings> };
    }) => catalogue.updateSettings(version, input),
    onSuccess: async (settings) => {
      queryClient.setQueryData(SETTINGS, settings);
      // The business name appears in the shell.
      await queryClient.invalidateQueries({ queryKey: ['auth', 'session'] });
    },
  });
}

export function useServices() {
  const { catalogue } = useDependencies();
  return useQuery({
    queryKey: SERVICES,
    queryFn: () => catalogue.listServices(),
    select: (services) => services.map(toServiceRow),
  });
}

/** Service changes also change the setup status shown on the dashboard. */
function useCatalogueMutation<TInput>(run: (input: TInput) => Promise<Service>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['catalogue'] }),
  });
}

export function useCreateService() {
  const { catalogue } = useDependencies();
  return useCatalogueMutation((input: ServiceInput) => catalogue.createService(input));
}

export function useUpdateService() {
  const { catalogue } = useDependencies();
  return useCatalogueMutation(
    ({ id, version, input }: { id: string; version: number; input: ServiceInput }) =>
      catalogue.updateService(id, version, input),
  );
}

export function useArchiveService() {
  const { catalogue } = useDependencies();
  return useCatalogueMutation((id: string) => catalogue.archiveService(id));
}

export { formatDollars, LIMITS, parseDollars, serviceProblems } from '../domain/catalogue';
