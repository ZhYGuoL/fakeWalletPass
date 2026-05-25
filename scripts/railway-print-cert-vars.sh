#!/usr/bin/env bash
# Print Railway-ready env var lines for Apple Wallet signing certs.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CERTS="$ROOT/certs"

for pair in "WWDR_PEM:wwdr.pem" "SIGNER_CERT_PEM:signer.pem" "SIGNER_KEY_PEM:signer.key"; do
  env_name="${pair%%:*}"
  file_name="${pair##*:}"
  path="$CERTS/$file_name"
  if [[ ! -f "$path" ]]; then
    echo "Missing $path" >&2
    exit 1
  fi
  escaped="$(awk '{printf "%s\\n", $0}' "$path" | sed 's/"/\\"/g')"
  echo "${env_name}=\"${escaped}\""
done

echo
echo "Paste each line above into Railway → Service → Variables."
