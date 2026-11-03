#!/usr/bin/env bash
# Sourced by the other scripts.
INFRA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPTS_DIR="${INFRA_DIR}/scripts"

# Keeps Git Bash from rewriting container paths as Windows ones. Only for docker, because curl there
# needs the opposite to find /dev/null. Other shells ignore it.
docker() {
  MSYS_NO_PATHCONV=1 command docker "$@"
}

compose() {
  "${SCRIPTS_DIR}/compose.sh" "$@"
}

# Exports .env for scripts that need its values themselves.
load_env() {
  set -a
  # shellcheck disable=SC1091
  . "${INFRA_DIR}/.env"
  set +a
}

# Machines without jq, such as Windows with Git Bash, get it from an image.
if ! command -v jq >/dev/null 2>&1; then
  jq() {
    docker run --rm -i ghcr.io/jqlang/jq:1.8.1 "$@"
  }
fi
