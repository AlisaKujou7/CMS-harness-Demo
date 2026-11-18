#!/usr/bin/env bash
# M-INF-01 to 03 on built images: no critical or high CVEs in the base, a non-root user, and at most
# 300 MB. The release workflow runs this before pushing anything.
# Usage: scripts/check-images.sh <image> [<image>...]
set -euo pipefail

max_bytes=$((300 * 1000 * 1000))
trivy_image=aquasec/trivy:0.68.1
failed=0

for image in "$@"; do
  echo "==> ${image}"

  user="$(docker image inspect --format '{{.Config.User}}' "${image}")"
  case "${user}" in
    '' | 0 | root | 0:* | root:*)
      echo "FAILED M-INF-02: runs as '${user:-root}'" >&2
      failed=1
      ;;
    *) echo "M-INF-02 passed: runs as ${user}" ;;
  esac

  # The migrate image only exists while a migration runs, and holds the Prisma CLI (ADR-0013).
  # Summed from the layers, because Docker's own figure also counts the compressed copies when it
  # stores images with containerd.
  size="$(docker history --human=false --format '{{.Size}}' "${image}" | awk '{ sum += $1 } END { printf "%d", sum }')"
  if [ "${size}" -gt "${max_bytes}" ] && [[ "${image}" != *cms-migrate* ]]; then
    echo "FAILED M-INF-03: ${size} bytes is over ${max_bytes}" >&2
    failed=1
  else
    echo "M-INF-03: ${size} bytes"
  fi

  # The variable keeps Git Bash from rewriting the socket's path as a Windows one.
  if ! MSYS_NO_PATHCONV=1 docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
    -v cms-trivy-cache:/root/.cache "${trivy_image}" image --quiet --exit-code 1 --ignore-unfixed \
    --severity CRITICAL,HIGH "${image}"; then
    echo "FAILED M-INF-01: ${image} has fixable critical or high CVEs" >&2
    failed=1
  fi
done

exit "${failed}"
