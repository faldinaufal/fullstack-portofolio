import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Self-contained server bundle for the Docker image (FSD 0.2, Containers).
  output: 'standalone',
  // The workspace root, so the standalone bundle includes the shared packages.
  outputFileTracingRoot: path.resolve(process.cwd(), '../../../..'),
  poweredByHeader: false,
  reactStrictMode: true,
};

export default nextConfig;
