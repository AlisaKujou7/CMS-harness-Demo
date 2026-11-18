#!/usr/bin/env bash
# Is the system alive and correctly exposed? Runs after every deploy, and changes no data
# (07-OPS-ARCH 22.2). Usage: SMOKE_API_KEY=... scripts/smoke-test.sh https://cms.example.com
# Without SMOKE_API_KEY, as on a first deploy, it skips reading the public API with a key.
# SMOKE_INSECURE=1 accepts a self-signed certificate. SMOKE_HTTP_URL also checks the redirect.
set -euo pipefail

# shellcheck source=scripts/lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

base="${1:?usage: smoke-test.sh <base url>}"
curl_flags=(-sS --max-time 15)
if [ "${SMOKE_INSECURE:-0}" = "1" ]; then
  curl_flags+=(-k)
fi

status_of() {
  curl "${curl_flags[@]}" -o /dev/null -w '%{http_code}' "$@"
}

expect_status() {
  local expected="$1"
  shift
  local actual
  actual="$(status_of "$@")"
  if [ "${actual}" != "${expected}" ]; then
    echo "FAILED: expected ${expected}, got ${actual} from: $*" >&2
    exit 1
  fi
}

# Takes the body as a value. Piping into `grep -q` could fail a healthy system, because grep stops
# at its match, and pipefail then counts the writer's broken pipe.
expect_body() {
  local expected="$1" body="$2"
  if ! grep -qi "${expected}" <<<"${body}"; then
    echo "FAILED: the response does not contain ${expected}" >&2
    exit 1
  fi
}

expect_header() {
  local headers="$1" name="$2"
  if ! grep -qi "^${name}:" <<<"${headers}"; then
    echo "FAILED: no ${name} header" >&2
    exit 1
  fi
}

echo "1. Health"
expect_status 200 "${base}/healthz"

echo "2. Readiness inside the network, as the application's database role"
expect_body '"ready"' "$(compose exec -T nginx wget -qO- http://cms-api:3000/readyz)"

echo "3. Readiness is not exposed outside"
expect_status 404 "${base}/readyz"

echo "4. Public API without a key is refused"
expect_status 401 "${base}/api/v1/articles"

if [ -n "${SMOKE_API_KEY:-}" ]; then
  echo "5. Public API with a key"
  curl "${curl_flags[@]}" -f -H "X-API-Key: ${SMOKE_API_KEY}" "${base}/api/v1/articles" |
    jq -e '.data | type == "array"' >/dev/null
else
  echo "5. SKIPPED: no SMOKE_API_KEY is set, so the public API was not read with a key"
fi

echo "6. Admin SPA, including a deep link on reload"
expect_body '<title' "$(curl "${curl_flags[@]}" -f "${base}/")"
expect_body '<title' "$(curl "${curl_flags[@]}" -f "${base}/content")"

echo "7. Security headers"
spa_headers="$(curl "${curl_flags[@]}" -o /dev/null -D - "${base}/")"
for header in Strict-Transport-Security Content-Security-Policy X-Content-Type-Options X-Frame-Options; do
  expect_header "${spa_headers}" "${header}"
done
api_headers="$(curl "${curl_flags[@]}" -o /dev/null -D - "${base}/healthz")"
expect_header "${api_headers}" Strict-Transport-Security

echo "8. API documentation"
expect_status 200 "${base}/openapi.json"
expect_status 200 "${base}/docs"

if [ -n "${SMOKE_HTTP_URL:-}" ]; then
  echo "9. HTTP redirects to HTTPS"
  expect_status 301 "${SMOKE_HTTP_URL}/"
fi

echo "All smoke checks passed."
