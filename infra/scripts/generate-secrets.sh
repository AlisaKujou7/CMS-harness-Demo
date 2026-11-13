#!/usr/bin/env bash
# Writes a new env file from a template, with a fresh random value for each placeholder
# (07-OPS-ARCH 8.3). Usage: scripts/generate-secrets.sh <template> <output>
set -euo pipefail

template="${1:?template required}"
output="${2:?output required}"

if [ -e "${output}" ]; then
  echo "${output} already exists, and overwriting it would lose its secrets." >&2
  exit 1
fi

umask 077
: >"${output}"
while IFS= read -r line || [ -n "${line}" ]; do
  case "${line}" in
    *=__CHANGE_ME_64_CHAR_HEX__)
      line="${line%%=*}=$(openssl rand -hex 64)"
      ;;
    *=__CHANGE_ME__)
      # Alphanumeric, because these also go inside connection URLs.
      line="${line%%=*}=$(openssl rand -base64 48 | tr -d '/+=\n' | cut -c1-32)"
      ;;
  esac
  printf '%s\n' "${line}" >>"${output}"
done <"${template}"
chmod 600 "${output}"

echo "Wrote ${output}"
if grep -qE '^[A-Z0-9_]+=__SET_ME__' "${output}"; then
  echo "Fill these in from their providers:"
  grep -E '^[A-Z0-9_]+=__SET_ME__' "${output}" | cut -d= -f1 | sed 's/^/  /'
fi
