// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import { joinPublicUrl, type ObjectStorage } from './storage.js';

/** In-memory storage for tests: `put` plays the browser's upload. */
export function createMemoryStorage(publicBaseUrl = 'http://files.test') {
  const objects = new Map<string, Uint8Array>();

  const storage: ObjectStorage = {
    presignUpload: async ({ key, contentType }) => ({
      url: `http://storage.test/upload/${key}`,
      headers: { 'Content-Type': contentType },
    }),
    stat: async (key) => {
      const bytes = objects.get(key);
      return bytes ? { sizeBytes: bytes.length } : null;
    },
    readStart: async (key, length) => (objects.get(key) ?? new Uint8Array()).slice(0, length),
    remove: async (key) => {
      objects.delete(key);
    },
    publicUrl: (key) => joinPublicUrl(publicBaseUrl, key),
  };

  return {
    ...storage,
    put: (key: string, bytes: Uint8Array) => void objects.set(key, bytes),
    has: (key: string) => objects.has(key),
  };
}

export type MemoryStorage = ReturnType<typeof createMemoryStorage>;
