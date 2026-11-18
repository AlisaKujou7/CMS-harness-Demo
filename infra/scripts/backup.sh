#!/usr/bin/env bash
# Backs up what cannot be rebuilt (07-OPS-ARCH 13). Usage: scripts/backup.sh postgres|media|env|all
# The systemd timers run postgres hourly, and media and env daily. Off-site copies go through restic.
set -euo pipefail

# shellcheck source=scripts/lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
load_env
cd "${INFRA_DIR}"

target="${1:?usage: backup.sh postgres|media|env|all}"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_root="${CMS_BACKUP_DIR:-${CMS_DATA_DIR}/backups}"

# Sends a directory off site under a tag, creating the repository the first time.
send_off_site() {
  local directory="$1" tag="$2"
  if [ -z "${BACKUP_RESTIC_REPOSITORY:-}" ]; then
    echo "No off-site repository is set, so ${tag} stays on this VM only."
    return
  fi
  restic_run -- cat config >/dev/null 2>&1 || restic_run -- init
  restic_run -v "${directory}:/backup/${tag}:ro" -- backup "/backup/${tag}" --tag "${tag}" \
    --tag "${CMS_VERSION:-unknown}"
  restic_run -- forget --tag "${tag}" --keep-hourly "${BACKUP_RETENTION_HOURLY:-24}" \
    --keep-daily "${BACKUP_RETENTION_DAILY:-30}" --keep-weekly "${BACKUP_RETENTION_WEEKLY:-12}" --prune
}

backup_postgres() {
  local hourly="${backup_root}/postgres/hourly" daily="${backup_root}/postgres/daily"
  local dump="${hourly}/cms-${timestamp}.dump"
  mkdir -p "${hourly}" "${daily}"

  # A partial file must never look like a backup, so it only gets its name once it is proven good.
  compose exec -T postgres sh -c \
    'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --compress=9' >"${dump}.partial"
  compose exec -T postgres pg_restore --list <"${dump}.partial" >/dev/null
  mv "${dump}.partial" "${dump}"
  echo "Wrote ${dump}"

  # The day's first dump is the daily one.
  local today
  today="$(date -u +%Y%m%d)"
  if ! find "${daily}" -name "cms-${today}T*.dump" | grep -q .; then
    cp "${dump}" "${daily}/"
  fi

  find "${hourly}" -name 'cms-*.dump' -mmin "+$((${BACKUP_RETENTION_HOURLY:-24} * 60))" -delete
  find "${daily}" -name 'cms-*.dump' -mtime "+${BACKUP_RETENTION_DAILY:-30}" -delete

  send_off_site "${hourly}" postgres
  date -u +%s >"${backup_root}/postgres/last-success"
}

backup_media() {
  if [ "${OBJECT_STORAGE_PROVIDER}" = "s3" ]; then
    : "${BACKUP_MEDIA_S3_BUCKET:?BACKUP_MEDIA_S3_BUCKET is required to back up S3 media}"
    docker run --rm -e AWS_ACCESS_KEY_ID="${BACKUP_S3_ACCESS_KEY}" \
      -e AWS_SECRET_ACCESS_KEY="${BACKUP_S3_SECRET_KEY}" amazon/aws-cli:2.27.0 \
      s3 sync "s3://${OBJECT_STORAGE_BUCKET}" "s3://${BACKUP_MEDIA_S3_BUCKET}" --delete
    return
  fi
  if [ -z "${BACKUP_RESTIC_REPOSITORY:-}" ]; then
    echo "No off-site repository is set, so media is not backed up." >&2
    return 1
  fi
  # Through the gateway's own volume, which restic reads with the extended attributes that hold each
  # object's content type.
  restic_run -- cat config >/dev/null 2>&1 || restic_run -- init
  restic_run --volumes-from "$(compose ps -q object-storage)" -- backup /data --tag media
  restic_run -- forget --tag media --keep-daily "${BACKUP_RETENTION_DAILY:-30}" --prune
}

# .env holds the secrets, so it only ever leaves this VM inside restic's encryption. The local copy
# is for going back after a bad edit, which needs no second encryption on a disk that holds the
# original anyway.
backup_env() {
  local env_dir="${backup_root}/env"
  mkdir -p "${env_dir}"
  (
    umask 077
    cp -L .env "${env_dir}/env-${timestamp}"
  )
  find "${env_dir}" -name 'env-*' -mtime +90 -delete
  send_off_site "${env_dir}" env
}

case "${target}" in
  postgres) backup_postgres ;;
  media) backup_media ;;
  env) backup_env ;;
  all)
    backup_postgres
    backup_media
    backup_env
    ;;
  *)
    echo "Unknown target ${target}" >&2
    exit 2
    ;;
esac
