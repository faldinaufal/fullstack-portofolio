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
cd "$(dirname "$0")"

export IMAGE_TAG="$sha"
docker compose pull --quiet
docker compose up -d --remove-orphans
# Keep the disk from filling up with old images (the running ones are kept).
docker image prune -f > /dev/null

echo "Deployed $sha"
