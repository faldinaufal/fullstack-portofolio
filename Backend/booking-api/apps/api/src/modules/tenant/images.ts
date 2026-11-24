// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import {
  IMAGE_MAX_BYTES,
  type ImageUpload,
  type ImageUploadRequest,
  type TenantImageKind,
  type TenantSettings,
} from '@tempora/contracts';
import type { Tx } from '@tempora/db';
import { recordAudit } from '../../lib/audit.js';
import { versionConflict } from '../../lib/route-schemas.js';
import { createImageUploads } from '../../lib/storage/image-upload.js';
import type { ObjectStorage } from '../../lib/storage/storage.js';
import { auditActor } from '../branches/service.js';
import type { ConsoleActor } from '../console-auth/guard.js';
import { setupStatus, toSettings } from './service.js';

const COLUMN = { logo: 'logoKey', cover: 'coverKey' } as const;

/** `tenants/<tenant>/<kind>`: the only place this tenant's logo or cover may live. */
const prefix = (tenantId: string, kind: TenantImageKind) => `tenants/${tenantId}/${kind}`;

/**
 * Logo and cover photo uploads (FSD 6.15). The browser uploads straight to storage with a
 * presigned URL; the API never handles the file itself. Because R2 cannot enforce a size
 * range at upload time, the stored object is checked again before it is used.
 */
export function createTenantImages({
  inTenant,
  storage,
}: {
  inTenant: <T>(actor: ConsoleActor, work: (tx: Tx) => Promise<T>) => Promise<T>;
  storage: ObjectStorage | null;
}) {
  /** Swaps the key in one transaction with its audit entry; returns the replaced key. */
  const setKey = (
    actor: ConsoleActor,
    kind: TenantImageKind,
    version: number,
    key: string | null,
  ) =>
    inTenant(actor, async (tx) => {
      const before = await tx.tenant.findUniqueOrThrow({ where: { id: actor.tenantId } });
      const { count } = await tx.tenant.updateMany({
        where: { id: actor.tenantId, version },
        data: { [COLUMN[kind]]: key, version: { increment: 1 } },
      });
      if (count === 0) throw versionConflict('business');
      await recordAudit(tx, auditActor(actor), {
        tenantId: actor.tenantId,
        action: 'tenant.updated',
        entityType: 'tenant',
        entityId: actor.tenantId,
        before: { [kind]: before[COLUMN[kind]] },
        after: { [kind]: key },
      });
      const after = await tx.tenant.findUniqueOrThrow({ where: { id: actor.tenantId } });
      return {
        settings: toSettings(after, await setupStatus(tx, actor.tenantId), storage),
        replaced: before[COLUMN[kind]],
      };
    });

  const uploads = createImageUploads(storage);

  return {
    requestImageUpload: (
      actor: ConsoleActor,
      kind: TenantImageKind,
      input: ImageUploadRequest,
    ): Promise<ImageUpload> =>
      uploads.presign(prefix(actor.tenantId, kind), IMAGE_MAX_BYTES[kind], input),

    async confirmImage(
      actor: ConsoleActor,
      kind: TenantImageKind,
      version: number,
      key: string,
    ): Promise<TenantSettings> {
      await uploads.verify(prefix(actor.tenantId, kind), IMAGE_MAX_BYTES[kind], key);
      const { settings, replaced } = await setKey(actor, kind, version, key);
      if (replaced !== key) await uploads.discard(replaced);
      return settings;
    },

    async removeImage(
      actor: ConsoleActor,
      kind: TenantImageKind,
      version: number,
    ): Promise<TenantSettings> {
      const { settings, replaced } = await setKey(actor, kind, version, null);
      await uploads.discard(replaced);
      return settings;
    },
  };
}
