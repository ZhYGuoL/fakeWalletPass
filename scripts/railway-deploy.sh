#!/usr/bin/env bash
# Deploy the iMessage agent to Railway. Run from repo root after `railway login`.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

RAILWAY="npx --yes @railway/cli"

if ! $RAILWAY whoami >/dev/null 2>&1; then
  echo "Not logged in. Run: npx @railway/cli login"
  exit 1
fi

if ! $RAILWAY status >/dev/null 2>&1; then
  echo "No Railway project linked yet."
  echo "Link this folder to your existing Railway project:"
  echo "  npx @railway/cli link"
  echo
  echo "To create a brand-new project instead:"
  echo "  npx @railway/cli init --name luma-imessage-agent"
  exit 1
fi

echo "Deploying to Railway..."
$RAILWAY up --detach

echo
echo "Done. Tail logs with:"
echo "  npx @railway/cli logs"
