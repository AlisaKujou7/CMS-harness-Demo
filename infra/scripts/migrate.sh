#!/usr/bin/env bash
# Pre-deploy step (07-OPS-ARCH 12.2). A failure exits non-zero, so the deploy stops before switching.
set -euo pipefail

# shellcheck source=scripts/lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

echo "==> Starting the database"
compose up -d --wait postgres

echo "==> Setting the application role's login"
compose exec -T postgres sh /docker-entrypoint-initdb.d/10-ensure-app-role.sh

echo "==> Applying migrations"
compose run --rm --no-deps cms-migrate
