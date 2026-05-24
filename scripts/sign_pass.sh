#!/usr/bin/env bash
# Sign Wallet pass after you have placed certificates in ./certs/:
#   wwdr.pem       — Apple WWDR G4 (or current) intermediate, from Apple PKI
#   signer.pem     — your Pass Type ID certificate (public)
#   signer.key     — private key for that certificate (decrypted PEM)
#
# Register Pass Type ID + create certificate:
#   developer.apple.com → Identifiers → Pass Type IDs → create
#   Certificates → create "Pass Type ID Certificate" for that identifier
#
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PASS_DIR="$ROOT/pass"
BUILD="$ROOT/build"
VENV="$ROOT/.venv"
mkdir -p "$BUILD"

if [[ ! -x "$VENV/bin/python3" ]]; then
  echo "Creating $VENV (Pillow for asset generation)…" >&2
  python3 -m venv "$VENV"
  "$VENV/bin/pip" install -q -r "$ROOT/requirements.txt"
fi
PY="$VENV/bin/python3"

if [[ ! -f "$PASS_DIR/pass.json" ]]; then
  echo "Missing pass/pass.json" >&2
  exit 1
fi

"$PY" "$ROOT/scripts/generate_assets.py"
"$PY" "$ROOT/scripts/package_pass.py"

WWDR="$ROOT/certs/wwdr.pem"
CERT="$ROOT/certs/signer.pem"
KEY="$ROOT/certs/signer.key"

if [[ ! -f $WWDR || ! -f $CERT || ! -f $KEY ]]; then
  echo "Place wwdr.pem, signer.pem, and signer.key in $ROOT/certs/"
  echo "Then re-run this script. Unsigned zip is at $BUILD/pass_unsigned.zip"
  exit 1
fi

openssl smime -binary -sign -certfile "$WWDR" -signer "$CERT" -inkey "$KEY" \
  -in "$PASS_DIR/manifest.json" -out "$PASS_DIR/signature" -outform DER

PKPASS="$BUILD/event-ticket.pkpass"
rm -f "$PKPASS"
cd "$PASS_DIR"
# Zip exactly manifest entries + manifest.json + signature (not source PNGs like luma_logo.png)
ZIP_LIST=(manifest.json signature)
while IFS= read -r line; do
  [[ -n "$line" ]] && ZIP_LIST+=("$line")
done < <("$PY" -c "import json; print('\\n'.join(sorted(json.load(open(\"manifest.json\")).keys())))")
zip -q "$PKPASS" "${ZIP_LIST[@]}"

echo "Signed pass: $PKPASS"
echo "AirDrop or email this file to your iPhone, then tap to add to Wallet."
