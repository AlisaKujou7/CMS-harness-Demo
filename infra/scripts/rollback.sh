#!/usr/bin/env bash
# Returns to an earlier release still on this VM (07-OPS-ARCH 11.3). Usage: scripts/rollback.sh <version>
# Only code goes back. Migrations are forward-only and each stays compatible with the release before
# it, so the database stays as it is (07-OPS-ARCH 12.2).
set -euo pipefail

version="${1:?usage: rollback.sh <version>}"
cms_home="${CMS_HOME:-/opt/cms}"
release_dir="${cms_home}/releases/${version}"

if [ ! -d "${release_dir}" ]; then
  echo "No release ${version} on this VM. Available:" >&2
  ls -1 "${cms_home}/releases" >&2
  exit 1
fi

ln -sfn "${release_dir}" "${cms_home}/current"
cd "${cms_home}/current"

# shellcheck source=scripts/lib.sh
. scripts/lib.sh
load_env

compose up -d --remove-orphans
scripts/wait-for-healthy.sh cms-api 120
scripts/wait-for-healthy.sh cms-worker 120
scripts/wait-for-healthy.sh nginx 60
scripts/smoke-test.sh "${PUBLIC_URL}"
echo "==> Rolled back to ${version}"
