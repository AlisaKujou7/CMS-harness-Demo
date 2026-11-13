#!/usr/bin/env bash
# Starts the local stack with what a demo needs: an Editor and an Author who joined through the real
# invitation flow, an article at each stage, and an API key. Safe to run again. docs/demo-guide.md is
# the walkthrough. The fixed passwords are for this stack alone, whose ports only this machine reaches.
set -euo pipefail

# shellcheck source=scripts/lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
cd "${INFRA_DIR}"

scripts/local-up.sh

base="https://localhost:8443"
mailpit="http://localhost:8025"
accounts=.local/demo-accounts.txt
editor_email=editor@cms.test
editor_password=Demo-Editor-2026
author_email=author@cms.test
author_password=Demo-Author-2026

set -a
# shellcheck disable=SC1091
. ./.local/admin.env
set +a

post() {
  local token="$1" path="$2" body="$3"
  curl -sSk -f -X POST -H "Authorization: Bearer ${token}" -H 'Content-Type: application/json' \
    -d "${body}" "${base}${path}"
}

sign_in() {
  local body
  body="$(jq -n --arg email "$1" --arg password "$2" '{email: $email, password: $password}')"
  post none /api/admin/auth/login "${body}" | jq -r '.data.access_token'
}

# Reads the emailed link as a new user would, so the seed cannot drift from the real flow.
accept_invitation() {
  local email="$1" password="$2" id="" token body
  for _ in $(seq 1 30); do
    id="$(curl -sS -G --data-urlencode "query=to:\"${email}\"" "${mailpit}/api/v1/search" |
      jq -r '.messages[0].ID // empty')"
    [ -n "${id}" ] && break
    sleep 1
  done
  [ -n "${id}" ] || {
    echo "No invitation reached ${email}" >&2
    exit 1
  }
  token="$(curl -sS "${mailpit}/api/v1/message/${id}" | jq -r '.Text' |
    grep -oE 'token=[A-Za-z0-9%._~-]+' | head -n 1 | cut -d= -f2)"
  body="$(jq -n --arg token "${token}" --arg password "${password}" \
    '{token: $token, new_password: $password}')"
  post none /api/admin/auth/invitations/accept "${body}" >/dev/null
}

article() {
  jq -n --arg title "$1" --arg text "$2" '{type: "article", title: $title, body: {type: "doc",
    content: [{type: "paragraph", content: [{type: "text", text: $text}]}]}}'
}

create_article() {
  post "$1" /api/admin/content "$(article "$2" "$3")" | jq -r '.data.id'
}

if [ ! -f "${accounts}" ]; then
  echo "==> Preparing demo accounts and content"
  admin_token="$(sign_in "${SEED_ADMIN_EMAIL}" "${SEED_ADMIN_PASSWORD}")"

  post "${admin_token}" /api/admin/users \
    "{\"email\":\"${editor_email}\",\"role\":\"editor\",\"name\":\"Demo Editor\"}" >/dev/null
  post "${admin_token}" /api/admin/users \
    "{\"email\":\"${author_email}\",\"role\":\"author\",\"name\":\"Demo Author\"}" >/dev/null
  accept_invitation "${editor_email}" "${editor_password}"
  accept_invitation "${author_email}" "${author_password}"

  author_token="$(sign_in "${author_email}" "${author_password}")"
  create_article "${author_token}" 'Office move: first draft' \
    'We are moving to a new office next quarter. Details to follow.' >/dev/null
  in_review="$(create_article "${author_token}" 'Getting started with the CMS' \
    'This guide shows new writers how to draft, submit and track an article.')"
  post "${author_token}" "/api/admin/content/${in_review}/submit" '{}' >/dev/null

  editor_token="$(sign_in "${editor_email}" "${editor_password}")"
  published="$(create_article "${editor_token}" 'Welcome to the new CMS' \
    'This article is published, so the public API returns it.')"
  post "${editor_token}" "/api/admin/content/${published}/publish" '{}' >/dev/null

  api_key="$(post "${admin_token}" /api/admin/api-keys '{"name":"demo frontend"}' | jq -r '.data.key')"

  (
    umask 077
    {
      echo "Admin   ${SEED_ADMIN_EMAIL}  ${SEED_ADMIN_PASSWORD}"
      echo "Editor  ${editor_email}  ${editor_password}"
      echo "Author  ${author_email}  ${author_password}"
      echo "API key ${api_key}"
    } >"${accounts}"
  )
fi

echo
echo "The demo is ready at ${base}"
echo "Accept the certificate warning there and at https://media.localhost:8443 first."
echo "Mail arrives at ${mailpit}"
echo
cat "${accounts}"
