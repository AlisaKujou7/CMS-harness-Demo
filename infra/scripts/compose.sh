#!/usr/bin/env bash
# docker compose with this environment's files, so nobody has to remember them or get them wrong.
# Usage: scripts/compose.sh ps | scripts/compose.sh logs --tail=200 cms-api
set -euo pipefail

# Keeps Git Bash from rewriting container paths as Windows ones. Other shells ignore it.
export MSYS_NO_PATHCONV=1

cd "$(dirname "${BASH_SOURCE[0]}")/.."

environment="$(sed -n 's/^CMS_ENVIRONMENT=//p' .env)"
files=(-f docker-compose.yml -f "docker-compose.${environment:?CMS_ENVIRONMENT is not set in .env}.yml")
env_files=(--env-file .env)
# Written by deploy.sh: which version this release directory runs.
if [ -f release.env ]; then
  env_files+=(--env-file release.env)
fi

exec docker compose "${files[@]}" "${env_files[@]}" "$@"
