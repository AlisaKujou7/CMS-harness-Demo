#!/usr/bin/env bash
# Start a new working session: install, show where the work stands, then run the fast gate.
# Read the output against `git log` before starting, as CLAUDE.md asks.
set -euo pipefail
cd "$(dirname "$0")"

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
