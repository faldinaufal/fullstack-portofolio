// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal

import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Self-contained server bundle for the Docker image (FSD 0.2, Containers).
  output: 'standalone',
  // The workspace root, so the standalone bundle includes the shared packages.
  outputFileTracingRoot: path.resolve(process.cwd(), '../../../..'),
  poweredByHeader: false,
  reactStrictMode: true,
  // Docker image builds only (see the root Dockerfile): CI type-checks separately, and fewer
  // workers keep three app builds side by side within Docker Desktop's memory.
  typescript: { ignoreBuildErrors: process.env.NEXT_SKIP_TYPECHECK === '1' },
  ...(process.env.NEXT_BUILD_CPUS && {
    experimental: { cpus: Number(process.env.NEXT_BUILD_CPUS) },
  }),
};

export default nextConfig;
