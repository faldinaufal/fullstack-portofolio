#!/bin/sh
# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
# Copyright (c) 2026 Farhan Aldi Naufal

# Starts a given commit's images on the server (FSD 10.2). The server holds no source code:
# CI copies this folder and `../docker` (Compose file, Caddyfile, init scripts) to /opt/tempora,
# then runs this script over SSH. By hand, to roll back to an earlier commit's images:
#   sh /opt/tempora/deploy/deploy.sh <commit sha>
#
# Pull the images, then `up -d`: Compose runs the migrations first and starts the API and
# worker only if they succeeded; containers whose image did not change keep running.
set -eu

sha="${1:?Usage: deploy.sh <commit sha>}"
case "$sha" in
  *[!0-9a-f]*) echo "Not a commit SHA: $sha" >&2; exit 1 ;;
esac
cd "$(dirname "$0")"

export IMAGE_TAG="$sha"
docker compose pull --quiet
docker compose up -d --remove-orphans
# Caddy reads its config only when its container starts, and `up` keeps the container when
# only the Caddyfile changed (a bind-mounted file even keeps pointing at the replaced copy).
# So recreate Caddy when the Caddyfile differs from the last deploy; certificates are kept in
# the caddy-data volume. The first run after this was added recreates it once.
caddyfile_sum=$(sha256sum Caddyfile | cut -d ' ' -f 1)
if [ "$caddyfile_sum" != "$(cat .caddyfile.sha256 2>/dev/null || true)" ]; then
  docker compose up -d --force-recreate --no-deps caddy
  echo "$caddyfile_sum" > .caddyfile.sha256
fi
# Record the running version in .env, so commands run by hand (`docker compose run --rm seed`)
# use these images too instead of an old `latest` left on the server.
if grep -q '^IMAGE_TAG=' .env; then
  sed -i "s/^IMAGE_TAG=.*/IMAGE_TAG=$sha/" .env
else
  echo "IMAGE_TAG=$sha" >> .env
fi
# Keep the disk from filling up with old images (the running ones are kept).
docker image prune -f > /dev/null

echo "Deployed $sha"
