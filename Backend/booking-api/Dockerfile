# syntax=docker/dockerfile:1
# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
# Copyright (c) 2026 Farhan Aldi Naufal

# Tempora API, worker and migration images. Build from the repository root:
#   docker build -f Backend/booking-api/Dockerfile --target api .
#   docker build -f Backend/booking-api/Dockerfile --target worker .
#   docker build -f Backend/booking-api/Dockerfile --target migrate .

ARG NODE_IMAGE=node:24.22-slim

# ---- build: install the workspace, compile, then copy each service's production files ----
FROM ${NODE_IMAGE} AS build
RUN npm install --global pnpm@10.34.9
WORKDIR /repo

COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm turbo run build --filter=@tempora/api... --filter=@tempora/worker...

# `pnpm deploy` writes a self-contained folder per service: its dist plus production
# dependencies only (workspace packages included), without the rest of the monorepo.
RUN pnpm --filter=@tempora/api deploy --prod /out/api \
 && pnpm --filter=@tempora/worker deploy --prod /out/worker \
 && pnpm --filter=@tempora/db deploy /out/migrate

# ---- api: Fastify server ----
FROM ${NODE_IMAGE} AS api
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /out/api ./
USER node
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/server.js"]

# ---- worker: pg-boss job runner ----
FROM ${NODE_IMAGE} AS worker
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /out/worker ./
USER node
CMD ["node", "dist/main.js"]

# ---- migrate: one-off release step, runs pending migrations with the owner role ----
FROM ${NODE_IMAGE} AS migrate
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /out/migrate ./
USER node
CMD ["node_modules/.bin/prisma", "migrate", "deploy"]
