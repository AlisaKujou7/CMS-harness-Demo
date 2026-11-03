#!/usr/bin/env bash
# Usage: scripts/wait-for-healthy.sh <service> [timeout seconds] (07-OPS-ARCH 22.3)
set -euo pipefail

# shellcheck source=scripts/lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

service="${1:?service required}"
timeout="${2:-60}"

status="missing"
deadline=$((SECONDS + timeout))
while ((SECONDS < deadline)); do
  container="$(compose ps -q "${service}" 2>/dev/null || true)"
  if [ -n "${container}" ]; then
    status="$(docker inspect --format='{{.State.Health.Status}}' "${container}" 2>/dev/null || echo missing)"
    if [ "${status}" = "healthy" ]; then
      echo "${service} is healthy"
      exit 0
    fi
  fi
  sleep 2
done

echo "Timed out waiting for ${service} (last status: ${status})" >&2
compose logs --tail=100 "${service}" >&2 || true
exit 1
