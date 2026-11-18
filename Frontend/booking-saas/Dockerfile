# syntax=docker/dockerfile:1
# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
# Copyright (c) 2026 Farhan Aldi Naufal

# One image definition for the three Tempora apps. Build from the repository root:
#   docker build -f Frontend/booking-saas/Dockerfile \
#     --build-arg APP=portal --build-arg NEXT_PUBLIC_API_URL=http://localhost:4000 .
# APP is one of: portal, console, platform-admin.

ARG NODE_IMAGE=node:24.22-slim

FROM ${NODE_IMAGE} AS build
ARG APP
# NEXT_PUBLIC_* values are compiled into the browser bundle, so they are build arguments.
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL} \
    NEXT_TELEMETRY_DISABLED=1
RUN test -n "$APP" || (echo "Build argument APP is required" && exit 1)
RUN npm install --global pnpm@10.34.9
WORKDIR /repo

COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm turbo run build --filter=@tempora/${APP}...

FROM ${NODE_IMAGE} AS runtime
ARG APP
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    APP_DIR=Frontend/booking-saas/apps/${APP}
WORKDIR /app

# Next.js "standalone" output: a minimal server plus only the files it needs.
COPY --from=build --chown=node:node /repo/${APP_DIR}/.next/standalone ./
COPY --from=build --chown=node:node /repo/${APP_DIR}/.next/static ./${APP_DIR}/.next/static

USER node
EXPOSE 3000
CMD ["sh", "-c", "exec node \"$APP_DIR/server.js\""]
