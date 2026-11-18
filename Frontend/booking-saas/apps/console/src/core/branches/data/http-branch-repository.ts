// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import type { ApiClient } from '@tempora/api-client';
import {
  BranchDetailSchema,
  BranchListSchema,
  ClosureSchema,
  type BranchDetail as BranchDetailDto,
} from '@tempora/contracts';
import { z } from 'zod';
import { request } from '../../shared/data/to-request-error';
import type { BranchDetail, BranchRepository } from '../domain/branch';

const BASE = '/v1/console/branches';

/** The contract and the domain have the same shape today; this keeps them free to diverge. */
const toDetail = (dto: BranchDetailDto): BranchDetail => ({
  ...dto,
  openingHours: dto.openingHours.map((h) => ({ ...h })),
  closures: dto.closures.map((c) => ({ ...c })),
});

export function createHttpBranchRepository(client: ApiClient): BranchRepository {
  return {
    list: () => request(async () => (await client.get(BASE, { schema: BranchListSchema })).items),

    get: (id) =>
      request(async () =>
        toDetail(await client.get(`${BASE}/${id}`, { schema: BranchDetailSchema })),
      ),

    create: (input) =>
      request(async () =>
        toDetail(await client.post(BASE, { schema: BranchDetailSchema, body: input })),
      ),

    update: (id, version, input) =>
      request(async () =>
        toDetail(
          await client.request(`${BASE}/${id}`, {
            method: 'PATCH',
            schema: BranchDetailSchema,
            body: input,
            headers: { 'If-Match': String(version) },
          }),
        ),
      ),

    archive: (id) =>
      request(async () =>
        toDetail(await client.post(`${BASE}/${id}/archive`, { schema: BranchDetailSchema })),
      ),

    replaceOpeningHours: (id, hours) =>
      request(async () =>
        toDetail(
          await client.request(`${BASE}/${id}/opening-hours`, {
            method: 'PUT',
            schema: BranchDetailSchema,
            body: { hours },
          }),
        ),
      ),

    addClosure: (id, closure) =>
      request(() =>
        client.post(`${BASE}/${id}/closures`, { schema: ClosureSchema, body: closure }),
      ),

    removeClosure: (id, closureId) =>
      request(async () => {
        await client.request(`${BASE}/${id}/closures/${closureId}`, {
          method: 'DELETE',
          schema: z.undefined(),
        });
      }),
  };
}
