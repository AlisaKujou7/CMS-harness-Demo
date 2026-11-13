#!/usr/bin/env bash
# Sourced by the other scripts.
INFRA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPTS_DIR="${INFRA_DIR}/scripts"
RESTIC_IMAGE=restic/restic:0.18.1

# Keeps Git Bash from rewriting container paths as Windows ones. Only for docker, because curl there
# needs the opposite to find /dev/null. Other shells ignore it.
docker() {
  MSYS_NO_PATHCONV=1 command docker "$@"
}

compose() {
  "${SCRIPTS_DIR}/compose.sh" "$@"
}

# Exports .env, and which version this release runs, for scripts that need the values themselves.
load_env() {
  set -a
  # shellcheck disable=SC1091
  . "${INFRA_DIR}/.env"
  if [ -f "${INFRA_DIR}/release.env" ]; then
    # shellcheck disable=SC1091
    . "${INFRA_DIR}/release.env"
  fi
  set +a
}

# Runs restic from its image, so that it can read data files owned by the containers' users. Extra
# `docker run` arguments come before `--`. The fixed host matters: each container has a random one,
# and retention groups snapshots by host, so it would otherwise never remove any.
restic_run() {
  local docker_args=()
  while [ "$1" != "--" ]; do
    docker_args+=("$1")
    shift
  done
  shift
  docker run --rm --hostname cms \
    -e RESTIC_REPOSITORY="${BACKUP_RESTIC_REPOSITORY:-}" \
    -e RESTIC_PASSWORD \
    -e AWS_ACCESS_KEY_ID="${BACKUP_S3_ACCESS_KEY:-}" \
    -e AWS_SECRET_ACCESS_KEY="${BACKUP_S3_SECRET_KEY:-}" \
    "${docker_args[@]}" "${RESTIC_IMAGE}" "$@"
}

# Machines without jq, such as Windows with Git Bash, get it from an image.
if ! command -v jq >/dev/null 2>&1; then
  jq() {
    docker run --rm -i ghcr.io/jqlang/jq:1.8.1 "$@"
  }
fi
