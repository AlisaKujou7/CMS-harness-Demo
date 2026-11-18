#!/usr/bin/env bash
# Creates the first Admin, since nobody can invite users until one exists. Does nothing to an account
# that already exists. Usage: SEED_ADMIN_EMAIL=... SEED_ADMIN_PASSWORD=... scripts/seed-admin.sh
set -euo pipefail

# shellcheck source=scripts/lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

: "${SEED_ADMIN_EMAIL:?SEED_ADMIN_EMAIL is required}"
: "${SEED_ADMIN_PASSWORD:?SEED_ADMIN_PASSWORD is required}"
export SEED_ADMIN_EMAIL SEED_ADMIN_PASSWORD

compose run --rm --no-deps -T -e SEED_ADMIN_EMAIL -e SEED_ADMIN_PASSWORD cms-api \
  node dist/composition/seed-admin.js
