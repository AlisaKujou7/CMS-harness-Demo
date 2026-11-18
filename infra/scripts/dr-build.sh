#!/usr/bin/env bash
# Rebuilds a working system on a VM after host-bootstrap.sh has run (07-OPS-ARCH 19.3). Needs the
# restic repository address and password from the break-glass record, since .env is what it restores.
# Usage: BACKUP_RESTIC_REPOSITORY=... RESTIC_PASSWORD=... BACKUP_S3_ACCESS_KEY=... \
#        BACKUP_S3_SECRET_KEY=... CMS_REPO_URL=... scripts/dr-build.sh <version>
set -euo pipefail

version="${1:?usage: dr-build.sh <version>}"
: "${BACKUP_RESTIC_REPOSITORY:?}" "${RESTIC_PASSWORD:?}" "${CMS_REPO_URL:?}"
cms_home="${CMS_HOME:-/opt/cms}"
env_file="${cms_home}/shared/env/.env.production"
restore_dir="$(mktemp -d)"

# shellcheck source=scripts/lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
export RESTIC_PASSWORD

# restic restores files as their original owners, and these include the secrets and a database dump.
clean_up() {
  docker run --rm -v "${restore_dir}:/restore" --entrypoint sh "${RESTIC_IMAGE}" -c 'rm -rf /restore/*'
  rm -rf "${restore_dir}"
}
trap clean_up EXIT

restic_restore() {
  restic_run -v "${restore_dir}:/restore" -- restore latest --tag "$1" --target /restore
}

echo "==> Restoring .env"
restic_restore env
newest_env="$(find "${restore_dir}/backup/env" -name 'env-*' | sort | tail -n 1)"
install -m 600 "${newest_env}" "${env_file}"

echo "==> Deploying ${version}"
checkout="$(mktemp -d)"
git clone --quiet --depth 1 --branch "v${version}" "${CMS_REPO_URL}" "${checkout}"
CMS_SKIP_SMOKE=1 "${checkout}/infra/scripts/deploy.sh" "${version}"
rm -rf "${checkout}"

echo "==> Restoring the database"
restic_restore postgres
newest_dump="$(find "${restore_dir}/backup/postgres" -name 'cms-*.dump' | sort | tail -n 1)"
"${cms_home}/releases/${version}/scripts/restore.sh" postgres "${newest_dump}"

echo "==> Restoring media"
"${cms_home}/releases/${version}/scripts/restore.sh" media latest

cd "${cms_home}/current"
scripts/compose.sh up -d --wait --remove-orphans
set -a
# shellcheck disable=SC1091
. ./.env
set +a
scripts/smoke-test.sh "${PUBLIC_URL}"
echo "==> Rebuilt. Now rotate every secret if this followed a breach (07-OPS-ARCH 19.2)."
