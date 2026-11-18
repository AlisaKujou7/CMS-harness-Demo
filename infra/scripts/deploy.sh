#!/usr/bin/env bash
# Deploys a tagged release onto this VM (07-OPS-ARCH 11.2). Usage: scripts/deploy.sh <version>
# A failed migration leaves the old release serving. A failure after the switch rolls back by itself,
# as gate G-08 asks. Set CMS_REPO_URL to the repository, in the environment or /opt/cms/deploy.conf.
set -euo pipefail

version="${1:?usage: deploy.sh <version>}"
cms_home="${CMS_HOME:-/opt/cms}"
if [ -f "${cms_home}/deploy.conf" ]; then
  # shellcheck disable=SC1091
  . "${cms_home}/deploy.conf"
fi
: "${CMS_REPO_URL:?CMS_REPO_URL is required}"
release_dir="${cms_home}/releases/${version}"
env_file="${cms_home}/shared/env/.env.production"
current="${cms_home}/current"

if grep -qE '^[A-Z0-9_]+=__(SET|CHANGE)_ME' "${env_file}"; then
  echo "Placeholders remain in ${env_file}:" >&2
  grep -E '^[A-Z0-9_]+=__(SET|CHANGE)_ME' "${env_file}" | cut -d= -f1 >&2
  exit 1
fi

echo "==> Preparing release ${version}"
checkout="$(mktemp -d)"
trap 'rm -rf "${checkout}"' EXIT
git clone --quiet --depth 1 --branch "v${version}" "${CMS_REPO_URL}" "${checkout}"
rm -rf "${release_dir}"
mkdir -p "${release_dir}"
cp -a "${checkout}/infra/." "${release_dir}/"
ln -sf "${env_file}" "${release_dir}/.env"
echo "CMS_VERSION=${version}" >"${release_dir}/release.env"

# shellcheck source=scripts/lib.sh
. "${release_dir}/scripts/lib.sh"
load_env
cd "${release_dir}"

echo "==> Pulling images"
compose --profile tools pull --ignore-buildable

# CMS_SKIP_SIGNATURE_CHECK is for rehearsing on a machine without a registry. Never in production.
if [ "${CMS_SKIP_SIGNATURE_CHECK:-0}" != "1" ]; then
  echo "==> Verifying image signatures"
  for image in cms-api cms-web cms-migrate; do
    cosign verify \
      --certificate-identity-regexp="^https://github\\.com/${CMS_GITHUB_REPO}/" \
      --certificate-oidc-issuer='https://token.actions.githubusercontent.com' \
      "${CMS_IMAGE_REGISTRY}/${image}:${version}" >/dev/null
  done
fi

scripts/migrate.sh

previous=""
if [ -L "${current}" ]; then
  previous="$(basename "$(readlink -f "${current}")")"
fi

rollback_on_failure() {
  local status=$?
  trap 'rm -rf "${checkout}"' EXIT
  if [ "${status}" -ne 0 ] && [ -n "${previous}" ] && [ "${previous}" != "${version}" ]; then
    echo "==> Deployment failed, rolling back to ${previous}" >&2
    "${cms_home}/releases/${previous}/scripts/rollback.sh" "${previous}" || true
  fi
  rm -rf "${checkout}"
  exit "${status}"
}
trap rollback_on_failure EXIT

echo "==> Switching symlink"
ln -sfn "${release_dir}" "${current}"

echo "==> Starting services"
cd "${current}"
compose up -d --remove-orphans

echo "==> Waiting for health"
scripts/wait-for-healthy.sh cms-api 120
scripts/wait-for-healthy.sh cms-worker 120
scripts/wait-for-healthy.sh nginx 60

# CMS_SKIP_SMOKE is for dr-build.sh, where the database only returns after this.
if [ "${CMS_SKIP_SMOKE:-0}" != "1" ]; then
  echo "==> Running post-deploy smoke tests"
  scripts/smoke-test.sh "${PUBLIC_URL}"
fi

trap 'rm -rf "${checkout}"' EXIT
echo "==> Deployment ${version} complete"

echo "==> Pruning old releases (keep the last 3)"
find "${cms_home}/releases" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' | sort -rn |
  tail -n +4 | cut -d' ' -f2- | while IFS= read -r old; do
  if [ "${old}" != "${release_dir}" ] && [ "$(basename "${old}")" != "${previous}" ]; then
    rm -rf "${old}"
  fi
done
