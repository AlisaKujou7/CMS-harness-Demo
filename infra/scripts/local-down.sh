#!/usr/bin/env bash
# Stops the local stack. --wipe also removes its data and generated secrets, for a fresh start.
set -euo pipefail

# shellcheck source=scripts/lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
cd "${INFRA_DIR}"

if [ "${1:-}" = "--wipe" ]; then
  compose --profile tools down --volumes --remove-orphans
  rm -rf .local .env
else
  compose --profile tools down --remove-orphans
fi
