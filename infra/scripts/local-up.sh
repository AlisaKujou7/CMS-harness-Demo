#!/usr/bin/env bash
# Builds and starts the whole stack on this machine, then proves it works. Safe to run again.
# Open https://localhost:8443 afterwards. The admin's password is in infra/.local/admin.env, and mail
# arrives at http://localhost:8025. Needs Docker, curl and openssl.
set -euo pipefail

# shellcheck source=scripts/lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
cd "${INFRA_DIR}"

local_dir=.local
admin_env="${local_dir}/admin.env"
mkdir -p "${local_dir}/tls" "${local_dir}/acme"

if [ ! -f .env ]; then
  echo "==> Generating secrets"
  scripts/generate-secrets.sh local.env.example .env
fi

if [ ! -f "${local_dir}/tls/fullchain.pem" ]; then
  echo "==> Creating a self-signed certificate"
  # Git Bash would otherwise rewrite the subject as a Windows path.
  MSYS_NO_PATHCONV=1 openssl req -x509 -newkey rsa:2048 -nodes -days 365 \
    -keyout "${local_dir}/tls/privkey.pem" -out "${local_dir}/tls/fullchain.pem" \
    -subj /CN=localhost -addext subjectAltName=DNS:localhost,DNS:media.localhost 2>/dev/null
  # nginx reads it as an unprivileged user, and this key protects nothing but this machine.
  chmod 644 "${local_dir}/tls/privkey.pem"
fi

if [ ! -f "${admin_env}" ]; then
  (
    umask 077
    {
      echo "SEED_ADMIN_EMAIL=admin@cms.test"
      echo "SEED_ADMIN_PASSWORD=$(openssl rand -hex 16)"
    } >"${admin_env}"
  )
fi
set -a
# shellcheck disable=SC1090
. "./${admin_env}"
set +a

echo "==> Building images"
compose --profile tools build

scripts/migrate.sh

echo "==> Creating the first Admin"
compose up -d --wait redis object-storage
scripts/seed-admin.sh

echo "==> Starting everything"
compose up -d --wait --remove-orphans

base="https://localhost:8443"
export SMOKE_INSECURE=1

if [ ! -f "${local_dir}/smoke-api-key" ]; then
  echo "==> Issuing an API key for the smoke tests"
  credentials="$(jq -n --arg email "${SEED_ADMIN_EMAIL}" --arg password "${SEED_ADMIN_PASSWORD}" \
    '{email: $email, password: $password}')"
  token="$(curl -sSk -f -H 'Content-Type: application/json' -d "${credentials}" \
    "${base}/api/admin/auth/login" | jq -r '.data.access_token')"
  curl -sSk -f -H "Authorization: Bearer ${token}" -H 'Content-Type: application/json' \
    -d '{"name":"local smoke tests"}' "${base}/api/admin/api-keys" |
    jq -r '.data.key' >"${local_dir}/smoke-api-key"
  chmod 600 "${local_dir}/smoke-api-key"
fi
SMOKE_API_KEY="$(tr -d '\r\n' <"${local_dir}/smoke-api-key")"
export SMOKE_API_KEY

SMOKE_HTTP_URL=http://localhost:8080 scripts/smoke-test.sh "${base}"
SMOKE_ADMIN_EMAIL="${SEED_ADMIN_EMAIL}" SMOKE_ADMIN_PASSWORD="${SEED_ADMIN_PASSWORD}" \
  MAILPIT_URL=http://localhost:8025 scripts/smoke-flow.sh "${base}"

echo
echo "The stack is up at ${base}"
