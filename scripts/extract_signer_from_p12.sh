#!/usr/bin/env bash
# Extract signer.pem + signer.key from Keychain-exported pass-cert.p12
# OpenSSL 3 needs -legacy for RC2-based .p12 from macOS Keychain.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/certs"

P12="${1:-pass-cert.p12}"
if [[ ! -f "$P12" ]]; then
  echo "Usage: $0 [path/to/pass-cert.p12]  (default: certs/pass-cert.p12)" >&2
  exit 1
fi

run_pkcs12() {
  if openssl pkcs12 -help 2>&1 | grep -q -- '-legacy'; then
    openssl pkcs12 -legacy "$@"
  else
    openssl pkcs12 "$@"
  fi
}

echo "Enter the .p12 export password when prompted."
run_pkcs12 -in "$P12" -clcerts -nokeys -out signer.pem
run_pkcs12 -in "$P12" -nocerts -nodes -out signer.key
echo "Wrote $ROOT/certs/signer.pem and signer.key"
