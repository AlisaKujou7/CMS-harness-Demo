#!/usr/bin/env bash
# Start a new working session: install, show where the work stands, then run the fast gate.
# Read the output against `git log` before starting, as CLAUDE.md asks.
set -euo pipefail
cd "$(dirname "$0")"

# The gate and the hook need the toolchain the repository pins. Stop with the reason, not halfway.
echo "== Checking the machine"
want="v$(tr -d '[:space:]' < .nvmrc)"
have="$(node --version 2>/dev/null || echo none)"
if [ "$have" != "$want" ]; then
  echo "Node is $have, but .nvmrc asks for $want. Install that version, then run init.sh again." >&2
  exit 1
fi
if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm is not available. Run 'corepack enable', then run init.sh again." >&2
  exit 1
fi
if ! docker version >/dev/null 2>&1; then
  echo "Warning: Docker is not running, so coverage and E2E in the full gate will fail." >&2
fi
if ! command -v gitleaks >/dev/null 2>&1; then
  echo "Warning: gitleaks is missing. The gate skips the secret scan, and the hook refuses commits." >&2
fi
echo "Node $have, pnpm $(pnpm --version)"

echo
echo "== Installing dependencies"
pnpm install --frozen-lockfile

echo
echo "== docs/harness/STATUS.md (current tickets)"
sed -n '/^## ตอนนี้/,/^## งานก่อน/p' docs/harness/STATUS.md | sed '$d'

echo "== docs/harness/state.json (what the hook enforces)"
cat docs/harness/state.json

echo
echo "== Branch and recent commits"
git branch --show-current
git log --oneline -5
git status --short

echo
echo "== pnpm gate:fast"
pnpm gate:fast
