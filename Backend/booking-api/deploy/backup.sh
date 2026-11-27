#!/bin/sh
# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
# Copyright (c) 2026 Farhan Aldi Naufal

# Nightly database backup (FSD 8.5): a compressed `pg_dump` in ~/backups, the last 7 kept.
# Install once with `crontab -e`:
#   30 3 * * * sh /opt/tempora/deploy/backup.sh >> $HOME/backups/backup.log 2>&1
# Restore: see README.md in this folder.
set -eu

dir="${BACKUP_DIR:-$HOME/backups}"
mkdir -p "$dir"
file="$dir/tempora-$(date -u +%Y%m%dT%H%M%SZ).dump"

cd "$(dirname "$0")"
# Custom format (-Fc): compressed, and pg_restore can restore single tables from it.
docker compose exec -T postgres pg_dump -U tempora -d tempora -Fc > "$file.partial"
mv "$file.partial" "$file"

# Keep the newest 7. The names are our own (no spaces), so `ls` is safe here.
# shellcheck disable=SC2012
ls -1t "$dir"/tempora-*.dump | tail -n +8 | xargs -r rm --
echo "$(date -u +%FT%TZ) backup written: $file"
