#!/usr/bin/env python3
from __future__ import annotations

import json
import uuid
from io import BytesIO
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import urlopen

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
PASS_DIR = ROOT / "pass"
PASS_JSON_PATH = PASS_DIR / "pass.json"
FALLBACK_IMAGE_PATH = PASS_DIR / "render-fallback.png"
DEFAULT_PASS_TYPE_IDENTIFIER = "pass.pass.com.zhiyuanguo.walletpasses"
DEFAULT_TEAM_IDENTIFIER = "N4GAW5JL9A"


def _load_existing_pass() -> dict:
    if PASS_JSON_PATH.is_file():
        with PASS_JSON_PATH.open("r", encoding="utf-8") as handle:
            return json.load(handle)
    return {}


def _build_serial_number(existing_pass: dict) -> str:
    base = str(existing_pass.get("serialNumber") or "TEST-PASS")
    return f"{base}-{uuid.uuid4().hex[:12]}"


def _safe_int(value: float) -> int:
    return max(0, min(255, int(round(value))))


def _average_rgb(image: Image.Image) -> tuple[int, int, int]:
    pixels = list(image.convert("RGB").resize((64, 64), Image.Resampling.LANCZOS).getdata())
    count = len(pixels)
    r = _safe_int(sum(pixel[0] for pixel in pixels) / count)
    g = _safe_int(sum(pixel[1] for pixel in pixels) / count)
    b = _safe_int(sum(pixel[2] for pixel in pixels) / count)
    return r, g, b


def _is_remote_image(value: str) -> bool:
    parsed = urlparse(value)
    return parsed.scheme in {"http", "https"}


def _load_source_image(payload: dict) -> Image.Image:
    source = payload.get("eventImageUrl")
    if isinstance(source, str) and source.strip():
        source = source.strip()
    else:
        source = str(FALLBACK_IMAGE_PATH)

    if _is_remote_image(source):
        data = urlopen(source, timeout=20).read()
        return Image.open(BytesIO(data)).convert("RGB")

    local_path = Path(source)
    if not local_path.is_absolute():
        local_path = ROOT / local_path
    if local_path.is_file():
        return Image.open(local_path).convert("RGB")

    if not FALLBACK_IMAGE_PATH.is_file():
        Image.new("RGB", (1125, 432), (52, 73, 94)).save(FALLBACK_IMAGE_PATH, format="PNG")
    return Image.open(FALLBACK_IMAGE_PATH).convert("RGB")


def _write_strip_images(image: Image.Image) -> None:
    for scale, size in (
        ("", (375, 144)),
        ("@2x", (750, 288)),
        ("@3x", (1125, 432)),
    ):
        resized = image.resize(size, Image.Resampling.LANCZOS)
        resized.save(PASS_DIR / f"strip{scale}.png", format="PNG")


def main() -> None:
    import sys

    if len(sys.argv) < 2:
        raise SystemExit("Usage: render_pass_payload.py <payload.json>")

    payload_path = Path(sys.argv[1])
    with payload_path.open("r", encoding="utf-8") as handle:
        payload = json.load(handle)

    existing_pass = _load_existing_pass()
    source_image = _load_source_image(payload)
    _write_strip_images(source_image)
    avg_r, avg_g, avg_b = _average_rgb(source_image)
    background = payload.get("backgroundColor") or f"rgb({avg_r},{avg_g},{avg_b})"

    start_value = payload.get("startDateTime") or payload.get("startDateText") or "TBD"
    address_value = payload.get("address") or "Address TBD"

    rendered_pass = {
        "formatVersion": 1,
        "passTypeIdentifier": existing_pass.get(
            "passTypeIdentifier",
            DEFAULT_PASS_TYPE_IDENTIFIER,
        ),
        "teamIdentifier": existing_pass.get("teamIdentifier", DEFAULT_TEAM_IDENTIFIER),
        "serialNumber": _build_serial_number(existing_pass),
        "organizationName": payload.get("organizationName") or "TEST / NOT VALID",
        "description": payload.get("testMarker") or payload.get("description") or "TEST / NOT VALID",
        "backgroundColor": background,
        "foregroundColor": existing_pass.get("foregroundColor", "rgb(255,255,255)"),
        "labelColor": existing_pass.get("labelColor", "rgb(255,255,255)"),
        "eventTicket": {
            "headerFields": [
                {
                    "key": "status",
                    "label": "STATUS",
                    "value": payload.get("testMarker") or "TEST / NOT VALID",
                }
            ],
            "primaryFields": [
                {
                    "key": "event",
                    "label": "EVENT",
                    "value": payload.get("eventTitle") or "Untitled Event",
                }
            ],
            "secondaryFields": [
                {
                    "key": "entry",
                    "label": "ENTRY",
                    "value": payload.get("hostOrTicketLabel") or payload.get("hostName") or "Unknown Host",
                },
                {
                    "key": "time",
                    "label": "TIME",
                    "value": start_value,
                },
            ],
            "auxiliaryFields": [
                {
                    "key": "guest",
                    "label": "GUEST",
                    "value": payload.get("guestName") or "Guest",
                },
                {
                    "key": "location",
                    "label": "LOCATION",
                    "value": address_value,
                },
            ],
        },
        "barcodes": [
            {
                "format": "PKBarcodeFormatQR",
                "message": payload.get("qrMessage") or "https://example.invalid/test-pass",
                "messageEncoding": "iso-8859-1",
            }
        ],
        "barcode": {
            "format": "PKBarcodeFormatQR",
            "message": payload.get("qrMessage") or "https://example.invalid/test-pass",
            "messageEncoding": "iso-8859-1",
        },
    }

    with PASS_JSON_PATH.open("w", encoding="utf-8") as handle:
        json.dump(rendered_pass, handle, indent=2)
        handle.write("\n")


if __name__ == "__main__":
    main()
