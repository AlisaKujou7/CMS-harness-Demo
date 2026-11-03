#!/usr/bin/env bash
# Weekly check that critical permissions have not drifted (07-OPS-ARCH 22.4). Run by a systemd timer
# as root, and a failure shows in `systemctl status`.
set -euo pipefail

cms_home="${CMS_HOME:-/opt/cms}"
data_dir="${CMS_DATA_DIR:-/var/lib/cms}"

# Path, then the expected mode and owner.
checks=(
  "${cms_home}/shared/env/.env.production|600 deploy:deploy"
  "/etc/cms/tls/privkey.pem|640 0:101"
  "${data_dir}/postgres|700 70:70"
  "${data_dir}/redis|700 999:1000"
  "${data_dir}/object-storage|700 1000:1000"
  "${data_dir}/backups|700 deploy:deploy"
)

failed=0
for check in "${checks[@]}"; do
  path="${check%%|*}"
  expected="${check#*|}"
  # Numeric owners for container users, which the host may not have by name.
  actual="$(stat -c '%a %U:%G' "${path}" 2>/dev/null || echo missing)"
  actual_numeric="$(stat -c '%a %u:%g' "${path}" 2>/dev/null || echo missing)"
  if [ "${actual}" != "${expected}" ] && [ "${actual_numeric}" != "${expected}" ]; then
    echo "DRIFT: ${path} expected=${expected} actual=${actual}" >&2
    failed=1
  fi
done
exit "${failed}"
