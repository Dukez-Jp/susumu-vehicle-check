#!/usr/bin/env bash
set -euo pipefail
script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$script_dir/.."
snapshot=${1:-dev-$(date -u +%Y%m%dT%H%M%SZ)}
[[ "$snapshot" =~ ^[a-zA-Z0-9][a-zA-Z0-9_-]{0,80}$ ]] || { printf 'Use a simple new snapshot folder name\n' >&2; exit 2; }
running=$(docker compose ps --status running --services)
resume_api=false
resume() { if [[ "$resume_api" == true ]]; then docker compose start api; fi; }
trap resume EXIT
if printf '%s\n' "$running" | grep -qx api; then
  resume_api=true
  docker compose stop --timeout 60 api
fi
docker compose --profile tools run --rm --build backup backup --photos /photos --output "/backups/$snapshot" --environment Development --writers-stopped
