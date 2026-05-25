#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

mkdir -p certs

write_pem_if_set() {
  local env_name="$1"
  local dest="$2"
  if [[ -n "${!env_name:-}" ]]; then
    # Railway may store PEMs with literal \n or real newlines.
    if [[ "${!env_name}" == *$'\n'* ]]; then
      printf '%s' "${!env_name}" >"$dest"
    else
      printf '%b' "${!env_name}" >"$dest"
    fi
    chmod 600 "$dest"
    echo "Wrote signing material to $dest (from ${env_name})"
  fi
}

write_pem_if_set WWDR_PEM "$ROOT/certs/wwdr.pem"
write_pem_if_set SIGNER_CERT_PEM "$ROOT/certs/signer.pem"
write_pem_if_set SIGNER_KEY_PEM "$ROOT/certs/signer.key"

missing_vars=()
for pair in "WWDR_PEM:wwdr.pem" "SIGNER_CERT_PEM:signer.pem" "SIGNER_KEY_PEM:signer.key"; do
  env_name="${pair%%:*}"
  file_name="${pair##*:}"
  if [[ ! -f "$ROOT/certs/$file_name" ]]; then
    if [[ -z "${!env_name:-}" ]]; then
      missing_vars+=("$env_name (not set)")
    else
      missing_vars+=("$env_name (set but failed to write $file_name)")
    fi
  fi
done

if ((${#missing_vars[@]} > 0)); then
  echo "Signing cert setup failed:" >&2
  for item in "${missing_vars[@]}"; do
    echo "  - $item" >&2
  done
  echo "In Railway: open service luma-imessage-agent → Variables → add WWDR_PEM, SIGNER_CERT_PEM, SIGNER_KEY_PEM" >&2
  exit 1
fi

if [[ ! -x "$ROOT/.venv/bin/python3" ]]; then
  python3 -m venv "$ROOT/.venv"
  "$ROOT/.venv/bin/pip" install --no-cache-dir -r "$ROOT/requirements.txt"
fi

if [[ -z "${PROJECT_ID:-}" || -z "${PROJECT_SECRET:-}" ]]; then
  echo "Missing PROJECT_ID or PROJECT_SECRET — set Photon credentials in Railway variables." >&2
  exit 1
fi

export USE_TERMINAL=false

echo "Starting Luma iMessage agent (Photon Spectrum Cloud)…"
exec npm --prefix "$ROOT/imessage-agent" start
