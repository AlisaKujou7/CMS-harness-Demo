#!/usr/bin/env bash
# Stops the local stack. --wipe also removes its data and generated secrets, for a fresh start.
set -euo pipefail

# shellcheck source=scripts/lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
cd "${INFRA_DIR}"

# By project name, without the Compose files, so that an .env older than them cannot block a reset.
if [ "${1:-}" = "--wipe" ]; then
  docker compose --project-name cms down --volumes --remove-orphans
  rm -rf .local .env
else
  docker compose --project-name cms down --remove-orphans
fi
