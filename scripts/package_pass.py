#!/usr/bin/env python3
"""
Build manifest.json and unsigned pass.zip from ./pass/.

Signing (required for a device) is a separate openssl step — see sign_pass.sh
or run:

 openssl smime -binary -sign -certfile wwdr.pem -signer signer.pem \\
 -inkey signer.key -in manifest.json -out signature -outform DER

Then zip pass.json, all images, manifest.json, and signature as .pkpass.
"""

from __future__ import annotations

import hashlib
import json
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PASS_DIR = ROOT / "pass"
OUT_MANIFEST = PASS_DIR / "manifest.json"
OUT_ZIP = ROOT / "build" / "pass_unsigned.zip"

# Source art in pass/ — do not ship inside .pkpass (manifest must match zip exactly).
EXCLUDE_PACKAGE_NAMES = frozenset({"luma_logo.png", "Y_Combinator_logo.svg"})


def sha1_file(path: Path) -> str:
    h = hashlib.sha1()
    h.update(path.read_bytes())
    return h.hexdigest()


def _is_packaged_pass_file(path: Path) -> bool:
    """Only files that actually ship inside .pkpass (Wallet ignores e.g. source .svg)."""
    if path.name.startswith("."):
        return False
    if path.name in {"manifest.json", "signature"}:
        return False
    if path.name in EXCLUDE_PACKAGE_NAMES:
        return False
    if path.suffix.lower() == ".svg":
        return False
    if path.name == "pass.json":
        return True
    if path.suffix.lower() in {".png", ".jpg", ".jpeg"}:
        return True
    return False


def main() -> None:
    if not (PASS_DIR / "pass.json").is_file():
        raise SystemExit(f"Missing {PASS_DIR / 'pass.json'}")

    files = sorted(p for p in PASS_DIR.iterdir() if p.is_file() and _is_packaged_pass_file(p))
    manifest = {p.name: sha1_file(p) for p in files}
    OUT_MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

    OUT_ZIP.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(OUT_ZIP, "w", zipfile.ZIP_DEFLATED) as z:
        for p in files:
            z.write(p, arcname=p.name)
        z.write(OUT_MANIFEST, arcname="manifest.json")

    print("Manifest:", OUT_MANIFEST)
    print("Unsigned bundle (add signature + re-zip for .pkpass):", OUT_ZIP)


if __name__ == "__main__":
    main()
