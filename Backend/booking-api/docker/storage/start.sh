#!/bin/sh
# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
# Copyright (c) 2026 Farhan Aldi Naufal

# Local S3-compatible object storage for business images (FSD 0.2, 6.15), standing in for
# Cloudflare R2. SeaweedFS runs the S3 API on port 8333 with two identities:
#   - the API's key pair (from .env): may read, write, list and delete;
#   - anonymous: may only read objects of the bucket, so browsers can load the images.
# The bucket is created on start if it does not exist yet.
set -eu

: "${S3_ACCESS_KEY_ID:?S3_ACCESS_KEY_ID is required}"
: "${S3_SECRET_ACCESS_KEY:?S3_SECRET_ACCESS_KEY is required}"
: "${S3_BUCKET:?S3_BUCKET is required}"

cat > /tmp/s3.json <<JSON
{
  "identities": [
    {
      "name": "tempora-api",
      "credentials": [{ "accessKey": "${S3_ACCESS_KEY_ID}", "secretKey": "${S3_SECRET_ACCESS_KEY}" }],
      "actions": ["Read", "Write", "List", "Tagging"]
    },
    { "name": "anonymous", "actions": ["Read:${S3_BUCKET}"] }
  ]
}
JSON

weed server -dir=/data -s3 -s3.port=8333 -s3.config=/tmp/s3.json &
server=$!

# `weed shell` talks to the master on 9333; retry until the bucket is listed.
until echo "s3.bucket.list" | weed shell -master=localhost:9333 2>/dev/null | grep -q "${S3_BUCKET}"; do
  echo "s3.bucket.create -name ${S3_BUCKET}" | weed shell -master=localhost:9333 >/dev/null 2>&1 || true
  sleep 2
done
echo "Storage ready: bucket ${S3_BUCKET}"

wait "$server"
