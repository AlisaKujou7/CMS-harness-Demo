#!/usr/bin/env bash
# Replaces the database with a dump, stopping the application meanwhile (07-OPS-ARCH 13.4). See
# runbooks/restore-from-backup.md first.
# Usage: scripts/restore.sh postgres <dump file>
#        scripts/restore.sh media <restic snapshot id|latest>
#        scripts/restore.sh snapshot <restic snapshot id|latest> <directory for the files>
set -euo pipefail

# shellcheck source=scripts/lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
load_env
cd "${INFRA_DIR}"

target="${1:?usage: restore.sh postgres <dump> | media <snapshot> | snapshot <snapshot> <directory>}"
source_ref="${2:?what to restore is required}"

restore_postgres() {
  local dump="$1"
  [ -f "${dump}" ] || {
    echo "No such dump: ${dump}" >&2
    exit 1
  }
  compose exec -T postgres pg_restore --list <"${dump}" >/dev/null

  echo "==> Stopping the application"
  compose stop cms-api cms-worker

  # The application starts again whatever happens below, so a failure is not also an outage of
  # services that could still read the old data.
  trap 'compose up -d cms-api cms-worker' EXIT

  echo "==> Replacing the database"
  compose exec -T postgres sh -c '
    dropdb -U "$POSTGRES_USER" --force "$POSTGRES_DB" &&
    createdb -U "$POSTGRES_USER" "$POSTGRES_DB"'
  compose exec -T postgres sh -s <"${INFRA_DIR}/postgres/ensure-app-role.sh"
  compose exec -T postgres sh -c \
    'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --exit-on-error --no-owner --role="$POSTGRES_USER"' \
    <"${dump}"

  # The dump can be older than this release, whose code expects its newest schema.
  scripts/migrate.sh

  trap - EXIT
  echo "==> Starting the application"
  compose up -d cms-api cms-worker
  scripts/wait-for-healthy.sh cms-api 120
  scripts/wait-for-healthy.sh cms-worker 120
}

restore_media() {
  local snapshot="$1"
  local container
  container="$(compose ps -aq object-storage)"
  echo "==> Stopping object storage"
  compose stop object-storage
  restic_run --volumes-from "${container}" -- restore "${snapshot}" --target / --tag media
  compose run --rm --no-deps object-storage-init
  compose up -d --wait object-storage
}

restore_snapshot() {
  local snapshot="$1" directory="${2:?a directory for the files is required}"
  mkdir -p "${directory}"
  restic_run -v "$(cd "${directory}" && pwd):/restore" -- restore "${snapshot}" --target /restore
}

case "${target}" in
  postgres) restore_postgres "${source_ref}" ;;
  media) restore_media "${source_ref}" ;;
  snapshot) restore_snapshot "${source_ref}" "${3:-}" ;;
  *)
    echo "Unknown target ${target}" >&2
    exit 2
    ;;
esac
echo "==> Restored. Now run scripts/smoke-test.sh against this environment."
