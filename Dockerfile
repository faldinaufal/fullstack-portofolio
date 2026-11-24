# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
# Copyright (c) 2026 Farhan Aldi Naufal

# Every Tempora image from one Dockerfile. Targets: api, worker, migrate, portal, console,
# platform-admin. `docker compose up --build` (or `docker buildx bake`) builds them together:
# they share one dependency install, the backend images share one backend build and the apps
# share one frontend build.
#
# Why it is fast:
# - `deps` sees only the package manifests and the lockfile, so dependencies are reinstalled only
#   when those change, never for a source change. The pnpm store is a cache mount, so even then
#   packages come from disk, not the network.
# - The backend and the frontend build from their own folders only: changing an app leaves the
#   backend images untouched (no rebuild, no re-export), and the other way round. The apps see
#   the backend's `contracts` package only, the one they import.
# - turbo's and Next.js' caches are mounted, so after a change only the packages it touches are
#   rebuilt.
# - Next.js skips its type check here (CI runs `pnpm typecheck`) and uses 2 workers, so three
#   app builds side by side stay within Docker Desktop's memory.

ARG NODE_IMAGE=node:24.22-slim

# ---- base: Node and pnpm ----
FROM ${NODE_IMAGE} AS base
ENV CI=1 \
    NEXT_TELEMETRY_DISABLED=1 \
    TURBO_TELEMETRY_DISABLED=1 \
    DO_NOT_TRACK=1
RUN npm install --global pnpm@10.34.9
WORKDIR /repo

# ---- manifests: package.json files, lockfile and workspace settings only ----
FROM base AS manifests
COPY . /src
RUN mkdir /out && cd /src \
 && cp package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc /out/ \
 && find . -name package.json -not -path '*/node_modules/*' -not -path './package.json' \
      -exec sh -c 'mkdir -p "/out/$(dirname "$1")" && cp "$1" "/out/$1"' _ {} \;

# ---- deps: the workspace's dependencies, cached until a manifest or the lockfile changes ----
FROM base AS deps
COPY --from=manifests /out ./
RUN --mount=type=cache,id=tempora-pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --prefer-offline --store-dir /pnpm/store
COPY turbo.json tsconfig.base.json ./

# ---- backend-build: API, worker and migrations, each laid out as a self-contained folder ----
FROM deps AS backend-build
COPY Backend/booking-api ./Backend/booking-api
RUN --mount=type=cache,id=tempora-turbo,target=/repo/.turbo/cache \
    pnpm turbo run build --filter=@tempora/api... --filter=@tempora/worker...
# `pnpm deploy` writes a folder per service: its dist plus production dependencies only
# (workspace packages included), without the rest of the monorepo.
RUN --mount=type=cache,id=tempora-pnpm,target=/pnpm/store \
    pnpm --filter=@tempora/api deploy --prod --prefer-offline --store-dir /pnpm/store /out/api \
 && pnpm --filter=@tempora/worker deploy --prod --prefer-offline --store-dir /pnpm/store /out/worker \
 && pnpm --filter=@tempora/db deploy --prefer-offline --store-dir /pnpm/store /out/migrate

# ---- frontend-build: the three Next.js apps ----
FROM deps AS frontend-build
# Compiled into the browser bundles, so it is a build argument (the host-facing API URL).
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL} \
    NEXT_SKIP_TYPECHECK=1 \
    NEXT_BUILD_CPUS=2
COPY Backend/booking-api/packages/contracts ./Backend/booking-api/packages/contracts
COPY Frontend/booking-saas ./Frontend/booking-saas
RUN --mount=type=cache,id=tempora-turbo,target=/repo/.turbo/cache \
    --mount=type=cache,id=tempora-next-portal,target=/repo/Frontend/booking-saas/apps/portal/.next/cache \
    --mount=type=cache,id=tempora-next-console,target=/repo/Frontend/booking-saas/apps/console/.next/cache \
    --mount=type=cache,id=tempora-next-admin,target=/repo/Frontend/booking-saas/apps/platform-admin/.next/cache \
    pnpm turbo run build \
      --filter=@tempora/portal... --filter=@tempora/console... --filter=@tempora/platform-admin...

# ---- backend images ----
FROM ${NODE_IMAGE} AS node-runtime
ENV NODE_ENV=production
WORKDIR /app
USER node

FROM node-runtime AS api
COPY --from=backend-build --chown=node:node /out/api ./
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/server.js"]

FROM node-runtime AS worker
COPY --from=backend-build --chown=node:node /out/worker ./
CMD ["node", "dist/main.js"]

# One-off release step: runs pending migrations with the owner role.
FROM node-runtime AS migrate
COPY --from=backend-build --chown=node:node /out/migrate ./
CMD ["node_modules/.bin/prisma", "migrate", "deploy"]

# ---- Next.js images: the "standalone" server plus only the files it needs ----
# (standalone leaves out `.next/static` and `public/`, so both are copied next to it)
FROM ${NODE_IMAGE} AS next-runtime
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
WORKDIR /app
USER node
EXPOSE 3000

FROM next-runtime AS portal
COPY --from=frontend-build --chown=node:node /repo/Frontend/booking-saas/apps/portal/.next/standalone ./
COPY --from=frontend-build --chown=node:node /repo/Frontend/booking-saas/apps/portal/.next/static ./Frontend/booking-saas/apps/portal/.next/static
COPY --from=frontend-build --chown=node:node /repo/Frontend/booking-saas/apps/portal/public ./Frontend/booking-saas/apps/portal/public
CMD ["node", "Frontend/booking-saas/apps/portal/server.js"]

FROM next-runtime AS console
COPY --from=frontend-build --chown=node:node /repo/Frontend/booking-saas/apps/console/.next/standalone ./
COPY --from=frontend-build --chown=node:node /repo/Frontend/booking-saas/apps/console/.next/static ./Frontend/booking-saas/apps/console/.next/static
COPY --from=frontend-build --chown=node:node /repo/Frontend/booking-saas/apps/console/public ./Frontend/booking-saas/apps/console/public
CMD ["node", "Frontend/booking-saas/apps/console/server.js"]

FROM next-runtime AS platform-admin
COPY --from=frontend-build --chown=node:node /repo/Frontend/booking-saas/apps/platform-admin/.next/standalone ./
COPY --from=frontend-build --chown=node:node /repo/Frontend/booking-saas/apps/platform-admin/.next/static ./Frontend/booking-saas/apps/platform-admin/.next/static
COPY --from=frontend-build --chown=node:node /repo/Frontend/booking-saas/apps/platform-admin/public ./Frontend/booking-saas/apps/platform-admin/public
CMD ["node", "Frontend/booking-saas/apps/platform-admin/server.js"]
