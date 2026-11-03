#!/usr/bin/env bash
# Does the deployed system work end to end? Signs in, publishes, uploads and invites, through nginx
# against the real services, then removes what it made. Run it on staging or locally rather than
# on production, where it would leave audit events and send an email.
# Usage: SMOKE_ADMIN_EMAIL=... SMOKE_ADMIN_PASSWORD=... SMOKE_API_KEY=... scripts/smoke-flow.sh <url>
# MAILPIT_URL also checks that the worker delivered the invitation.
set -euo pipefail

# shellcheck source=scripts/lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

base="${1:?usage: smoke-flow.sh <base url>}"
: "${SMOKE_ADMIN_EMAIL:?SMOKE_ADMIN_EMAIL is required}"
: "${SMOKE_ADMIN_PASSWORD:?SMOKE_ADMIN_PASSWORD is required}"
: "${SMOKE_API_KEY:?SMOKE_API_KEY is required}"

curl_flags=(-sS --max-time 30)
if [ "${SMOKE_INSECURE:-0}" = "1" ]; then
  curl_flags+=(-k)
fi
run_id="smoke-$(date +%s)"
work_dir="$(mktemp -d)"
trap 'rm -rf "${work_dir}"' EXIT

# Fails with the response body, which says why.
call() {
  local method="$1" path="$2"
  shift 2
  local body="${work_dir}/response" code
  code="$(curl "${curl_flags[@]}" -o "${body}" -w '%{http_code}' -X "${method}" \
    -H "Authorization: Bearer ${token:-none}" -H 'Content-Type: application/json' \
    "$@" "${base}${path}")"
  case "${code}" in
    2*) cat "${body}" ;;
    *)
      echo "FAILED: ${method} ${path} answered ${code}: $(cat "${body}")" >&2
      return 1
      ;;
  esac
}

echo "1. Sign in"
credentials="$(jq -n --arg email "${SMOKE_ADMIN_EMAIL}" --arg password "${SMOKE_ADMIN_PASSWORD}" \
  '{email: $email, password: $password}')"
token="$(call POST /api/admin/auth/login -d "${credentials}" | jq -r '.data.access_token')"

echo "2. Create and publish an article"
title="Smoke article ${run_id}"
article="$(jq -n --arg title "${title}" '{type: "article", title: $title, body: {type: "doc",
  content: [{type: "paragraph", content: [{type: "text", text: "Smoke test body."}]}]}}')"
created="$(call POST /api/admin/content -d "${article}")"
article_id="$(jq -r '.data.id' <<<"${created}")"
slug="$(jq -r '.data.slug' <<<"${created}")"
call POST "/api/admin/content/${article_id}/publish" >/dev/null

echo "3. Read it from the public API"
curl "${curl_flags[@]}" -f -H "X-API-Key: ${SMOKE_API_KEY}" "${base}/api/v1/articles/${slug}" |
  jq -e --arg title "${title}" '.data.title == $title' >/dev/null

echo "4. Unpublishing removes it at once"
call POST "/api/admin/content/${article_id}/unpublish" >/dev/null
gone="$(curl "${curl_flags[@]}" -o /dev/null -w '%{http_code}' -H "X-API-Key: ${SMOKE_API_KEY}" \
  "${base}/api/v1/articles/${slug}")"
[ "${gone}" = "404" ] || {
  echo "FAILED: an unpublished article answered ${gone}" >&2
  exit 1
}
call DELETE "/api/admin/content/${article_id}" >/dev/null

echo "5. Upload an image directly to storage, through a signed URL"
image="${work_dir}/smoke.png"
base64 -d >"${image}" <<<'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
size="$(wc -c <"${image}" | tr -d ' ')"
presign="$(jq -n --arg name "${run_id}.png" --argjson size "${size}" \
  '{filename: $name, mime_type: "image/png", size_bytes: $size}')"
presigned="$(call POST /api/admin/media/presign -d "${presign}")"
upload_url="$(jq -r '.data.upload_url' <<<"${presigned}")"
storage_key="$(jq -r '.data.storage_key' <<<"${presigned}")"
curl "${curl_flags[@]}" -f -X PUT -H 'Content-Type: image/png' --data-binary "@${image}" \
  "${upload_url}" >/dev/null

echo "6. Finalize it, and wait for the worker to make its variants"
finalize="$(jq -n --arg key "${storage_key}" --arg name "${run_id}.png" \
  '{storage_key: $key, filename: $name, mime_type: "image/png", alt_text: "Smoke test"}')"
media_id="$(call POST /api/admin/media -d "${finalize}" | jq -r '.data.id')"
variant_status=""
for _ in $(seq 1 30); do
  media="$(call GET "/api/admin/media/${media_id}")"
  variant_status="$(jq -r '.data.variant_status' <<<"${media}")"
  [ "${variant_status}" = "ready" ] && break
  sleep 1
done
[ "${variant_status}" = "ready" ] || {
  echo "FAILED: variants are ${variant_status} after 30 seconds" >&2
  exit 1
}

echo "7. Download the original and a variant from their signed URLs"
curl "${curl_flags[@]}" -f -o /dev/null "$(jq -r '.data.url' <<<"${media}")"
curl "${curl_flags[@]}" -f -o /dev/null "$(jq -r '.data.variants | to_entries[0].value.url' <<<"${media}")"
call DELETE "/api/admin/media/${media_id}" >/dev/null

echo "8. Invite a user"
invitee="${run_id}@cms.test"
invitation="$(jq -n --arg email "${invitee}" '{email: $email, role: "author", name: "Smoke Test"}')"
user_id="$(call POST /api/admin/users -d "${invitation}" | jq -r '.data.id')"

if [ -n "${MAILPIT_URL:-}" ]; then
  echo "9. The worker delivers the invitation"
  delivered=0
  for _ in $(seq 1 30); do
    delivered="$(curl -sS --max-time 10 -G --data-urlencode "query=to:${invitee}" \
      "${MAILPIT_URL}/api/v1/search" | jq -r '.messages_count')"
    [ "${delivered}" != "0" ] && break
    sleep 1
  done
  [ "${delivered}" != "0" ] || {
    echo "FAILED: no invitation reached Mailpit after 30 seconds" >&2
    exit 1
  }
fi
call DELETE "/api/admin/users/${user_id}" >/dev/null

echo "10. The API and worker hold only the application role"
compose exec -T postgres sh -c '
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc \
    "SELECT count(*) FROM pg_stat_activity
     WHERE usename = current_user AND backend_type = '\''client backend'\'' AND pid <> pg_backend_pid()"
' | grep -qx '0' || {
  echo "FAILED: something other than this check is connected as the database owner" >&2
  exit 1
}
if compose exec -T postgres sh -c '
  PGPASSWORD="$CMS_APP_DB_PASSWORD" psql -h 127.0.0.1 -U cms_app -d "$POSTGRES_DB" \
    -c "TRUNCATE audit_events"' >/dev/null 2>&1; then
  echo "FAILED: the application role could empty the audit log" >&2
  exit 1
fi

echo "All flow checks passed."
