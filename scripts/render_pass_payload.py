#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import uuid
from datetime import datetime
from io import BytesIO
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
PASS_DIR = ROOT / "pass"
PASS_JSON_PATH = PASS_DIR / "pass.json"
FALLBACK_IMAGE_PATH = PASS_DIR / "render-fallback.png"
DEFAULT_PASS_TYPE_IDENTIFIER = "pass.pass.com.zhiyuanguo.walletpasses"
DEFAULT_TEAM_IDENTIFIER = "N4GAW5JL9A"

# Calibrated against wallet-web/Real_Photon.jpg and wallet-web/Real_GenZ.png
PASS_STYLE_OVERRIDES: dict[str, dict[str, str]] = {
    "qifsyhwo": {
        "backgroundColor": "rgb(26, 24, 27)",
        "labelColor": "rgb(172, 180, 176)",
        "headerDateFormat": "us_medium",
    },
    "byobhyun": {
        "backgroundColor": "rgb(50, 91, 165)",
        "labelColor": "rgb(200, 200, 200)",
        "headerDateFormat": "day_first",
    },
    # https://luma.com/yachtparty1 — hardcoded cream background (#F8F2DD)
    "yachtparty1": {
        "backgroundColor": "rgb(248, 242, 221)",
    },
}


def _luma_event_slug(source_url: str | None) -> str | None:
    if not source_url:
        return None
    segment = urlparse(source_url).path.strip("/").split("/")[0]
    return segment.lower() if segment else None


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


def _hex_to_rgb(hex_color: str) -> tuple[int, int, int]:
    value = hex_color.strip().lstrip("#")
    if len(value) != 6:
        raise ValueError(f"Invalid hex color: {hex_color}")
    return int(value[0:2], 16), int(value[2:4], 16), int(value[4:6], 16)


def _rgb_string(r: int, g: int, b: int) -> str:
    return f"rgb({r}, {g}, {b})"


def _luminance(r: int, g: int, b: int) -> float:
    return 0.299 * r + 0.587 * g + 0.114 * b


def _is_dark_bg(hex_color: str) -> bool:
    r, g, b = _hex_to_rgb(hex_color)
    return _luminance(r, g, b) < 128


# Backgrounds at or above this luminance need dark text instead of the
# dark-pass default of white.
LIGHT_BG_LUMINANCE = 140
LIGHT_BG_FOREGROUND = "rgb(33, 33, 33)"
LIGHT_BG_LABEL = "rgb(95, 95, 95)"


def _parse_rgb_string(value: str | None) -> tuple[int, int, int] | None:
    match = re.match(
        r"\s*rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)\s*$",
        value or "",
        re.IGNORECASE,
    )
    if not match:
        return None
    return tuple(_safe_int(int(c)) for c in match.groups())


def _is_light_background(background: str) -> bool:
    rgb = _parse_rgb_string(background)
    if rgb is None:
        return False
    return _luminance(*rgb) >= LIGHT_BG_LUMINANCE


def _is_accent_label(hex_color: str) -> bool:
    """Bright saturated accent (e.g. Canopy Festival neon green labels)."""
    r, g, b = _hex_to_rgb(hex_color)
    lum = _luminance(r, g, b)
    max_c = max(r, g, b)
    min_c = min(r, g, b)
    saturation = 0 if max_c == 0 else (max_c - min_c) / max_c
    return lum >= 120 and saturation >= 0.5


def _is_neon_accent(hex_color: str) -> bool:
    """Neon label accents (green/orange) — not cover blues used as pass backgrounds."""
    if not _is_accent_label(hex_color):
        return False
    r, g, b = _hex_to_rgb(hex_color)
    return not (b >= max(r, g) * 0.92 and b > 80)


def _top_palette_color(colors: list[dict] | None) -> dict | None:
    if not colors:
        return None
    return max(colors, key=lambda entry: entry.get("percentage", 0))


def _pass_background_rgb(r: int, g: int, b: int) -> tuple[int, int, int]:
    """Snap near-black to pure black; darken light cover colors for Wallet contrast."""
    if _luminance(r, g, b) < 15:
        return 0, 0, 0
    if _luminance(r, g, b) >= 128:
        return (
            _safe_int(r * 0.55),
            _safe_int(g * 0.65),
            _safe_int(b * 0.77),
        )
    return r, g, b


def _default_label_on_background(bg_rgb: tuple[int, int, int]) -> str:
    lum = _luminance(*bg_rgb)
    if 35 <= lum <= 130:
        return "rgb(200, 200, 200)"
    return "rgb(160, 160, 160)"


def _lightest_neutral_label(palette: dict) -> str:
    """Muted label grey from the cover's light neutral swatch (matches real Luma passes)."""
    best_hex = None
    best_lum = -1.0
    for entry in palette.get("neutral") or []:
        color = entry.get("color")
        if not color or _is_dark_bg(color):
            continue
        r, g, b = _hex_to_rgb(color)
        lum = _luminance(r, g, b)
        if lum > 220:
            continue
        if lum > best_lum:
            best_lum = lum
            best_hex = color
    if best_hex:
        r, g, b = _hex_to_rgb(best_hex)
        return _rgb_string(r, g, b)
    return "rgb(160, 160, 160)"


ACCENT_LABEL_MIN_PCT = 10.0


def colors_from_luma_palette(palette: dict | None) -> tuple[str | None, str | None]:
    """
    Luma stores cover-image palette in __NEXT_DATA__ at data.cover_image.palette
    (neutral + vibrant buckets with percentage weights). Real passes use this,
    not a simple average of the thumbnail pixels.

    Background: dominant dark neutral when it beats vibrant share; else top dark vibrant.
    Labels: top vibrant only when it is a strong accent (e.g. Canopy Festival green);
    otherwise the light neutral grey from the cover palette.
    """
    if not palette:
        return None, None

    neutral = _top_palette_color(palette.get("neutral"))
    vibrant = _top_palette_color(palette.get("vibrant"))

    background_hex = None
    if neutral and vibrant:
        n_pct = neutral.get("percentage", 0)
        v_pct = vibrant.get("percentage", 0)
        n_color = neutral.get("color")
        v_color = vibrant.get("color")
        if n_color and n_pct > v_pct and _is_dark_bg(n_color):
            background_hex = n_color
        elif v_color and _is_dark_bg(v_color):
            background_hex = v_color
        elif n_color and _is_dark_bg(n_color):
            background_hex = n_color
        elif v_color:
            background_hex = v_color
    elif neutral and neutral.get("color"):
        background_hex = neutral["color"]
    elif vibrant and vibrant.get("color"):
        background_hex = vibrant["color"]

    label_color = _lightest_neutral_label(palette)
    if vibrant and vibrant.get("color"):
        pct = vibrant.get("percentage", 0)
        if pct >= ACCENT_LABEL_MIN_PCT and _is_neon_accent(vibrant["color"]):
            r, g, b = _hex_to_rgb(vibrant["color"])
            label_color = _rgb_string(r, g, b)

    if background_hex:
        bg_rgb = _pass_background_rgb(*_hex_to_rgb(background_hex))
        if label_color == "rgb(160, 160, 160)":
            label_color = _default_label_on_background(bg_rgb)
        r, g, b = bg_rgb
        return _rgb_string(r, g, b), label_color
    return None, label_color


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


def _fetch_remote_bytes(url: str) -> bytes:
    request = Request(
        url,
        headers={
            "User-Agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            ),
            "Accept": "image/*,*/*",
            "Referer": "https://luma.com/",
        },
    )
    with urlopen(request, timeout=20) as response:
        return response.read()


def _fallback_image() -> Image.Image:
    if not FALLBACK_IMAGE_PATH.is_file():
        Image.new("RGB", (270, 270), (52, 73, 94)).save(FALLBACK_IMAGE_PATH, format="PNG")
    return Image.open(FALLBACK_IMAGE_PATH).convert("RGB")


def _load_source_image(payload: dict) -> Image.Image:
    source = payload.get("eventImageUrl")
    if isinstance(source, str) and source.strip():
        source = source.strip()
    else:
        return _fallback_image()

    if _is_remote_image(source):
        try:
            data = _fetch_remote_bytes(source)
            return Image.open(BytesIO(data)).convert("RGB")
        except (HTTPError, URLError, OSError, ValueError):
            return _fallback_image()

    local_path = Path(source)
    if not local_path.is_absolute():
        local_path = ROOT / local_path
    if local_path.is_file():
        return Image.open(local_path).convert("RGB")

    return _fallback_image()


def _square_crop(image: Image.Image) -> Image.Image:
    side = min(image.width, image.height)
    left = (image.width - side) // 2
    top = (image.height - side) // 2
    return image.crop((left, top, left + side, top + side))


def _write_thumbnail_images(image: Image.Image) -> None:
    """Event ticket art on the right — matches real Luma passes (not strip)."""
    cropped = _square_crop(image)
    for suffix, px in (("", 90), ("@2x", 180), ("@3x", 270)):
        cropped.resize((px, px), Image.Resampling.LANCZOS).save(
            PASS_DIR / f"thumbnail{suffix}.png",
            format="PNG",
        )


def _remove_strip_images() -> None:
    for name in ("strip.png", "strip@2x.png", "strip@3x.png"):
        path = PASS_DIR / name
        if path.is_file():
            path.unlink()


def _format_location(payload: dict) -> str:
    """Luma passes show the short street line (geo.address), not venue | address."""
    address = str(payload.get("address") or "").strip()
    if address:
        return address
    location_name = str(payload.get("locationName") or "").strip()
    return location_name or "Location TBD"


def _parse_iso_datetime(start_iso: str) -> datetime:
    normalized = start_iso.strip().replace("Z", "+00:00")
    return datetime.fromisoformat(normalized)


def _local_start_dt(start_iso: str, timezone: str | None) -> datetime:
    dt = _parse_iso_datetime(start_iso)
    if timezone:
        try:
            dt = dt.astimezone(ZoneInfo(timezone))
        except Exception:
            pass
    return dt


def _format_header_time_label(start_iso: str, timezone: str | None) -> str:
    """Small grey line above the date — matches real Luma header layout."""
    dt = _local_start_dt(start_iso, timezone)
    hour = dt.hour % 12 or 12
    return f"{hour}:{dt.strftime('%M %p')}"


def _format_header_date_text(start_iso: str, timezone: str | None, fmt: str) -> str:
    dt = _local_start_dt(start_iso, timezone)
    if fmt == "day_first":
        return f"{dt.day} {dt.strftime('%B %Y')}"
    if fmt == "us_medium":
        return dt.strftime("%B %d, %Y")
    raise ValueError(f"Unknown header date format: {fmt}")


def _header_datetime_field(
    start_iso: str,
    timezone: str | None,
    date_format: str | None = None,
) -> dict:
    """
    Luma uses one right-aligned header field: time as label (labelColor, small),
    date as value (foregroundColor, large).
    """
    field: dict = {
        "key": "datetime",
        "label": _format_header_time_label(start_iso, timezone),
        "textAlignment": "PKTextAlignmentRight",
    }
    if date_format:
        field["value"] = _format_header_date_text(start_iso, timezone, date_format)
    else:
        field["value"] = start_iso
        field["dateStyle"] = "PKDateStyleMedium"
        field["timeStyle"] = "PKDateStyleNone"
        field["isRelative"] = False
    return field


def _barcode_block(payload: dict) -> dict:
    message = payload.get("qrMessage") or "https://example.invalid/test-pass"
    return {
        "format": "PKBarcodeFormatQR",
        "message": message,
        "messageEncoding": "iso-8859-1",
    }


def main() -> None:
    import sys

    if len(sys.argv) < 2:
        raise SystemExit("Usage: render_pass_payload.py <payload.json>")

    payload_path = Path(sys.argv[1])
    with payload_path.open("r", encoding="utf-8") as handle:
        payload = json.load(handle)

    existing_pass = _load_existing_pass()
    source_image = _load_source_image(payload)
    _remove_strip_images()
    _write_thumbnail_images(source_image)
    avg_r, avg_g, avg_b = _average_rgb(source_image)
    palette_bg, palette_labels = colors_from_luma_palette(payload.get("palette"))
    style_override = PASS_STYLE_OVERRIDES.get(_luma_event_slug(payload.get("sourceUrl")) or "", {})
    background = (
        style_override.get("backgroundColor")
        or payload.get("backgroundColor")
        or palette_bg
        or _rgb_string(avg_r, avg_g, avg_b)
    )
    light_bg = _is_light_background(background)

    foreground = (
        style_override.get("foregroundColor")
        or payload.get("foregroundColor")
        or (LIGHT_BG_FOREGROUND if light_bg else "rgb(255, 255, 255)")
    )

    label_color = (
        style_override.get("labelColor")
        or palette_labels
        or "rgb(160, 160, 160)"
    )
    # Palette/auto labels are always light tones (tuned for dark passes), so on
    # a light background swap to a muted dark grey unless a label was set.
    if (
        light_bg
        and not style_override.get("labelColor")
        and not payload.get("labelColor")
    ):
        label_color = LIGHT_BG_LABEL
    header_date_format = style_override.get("headerDateFormat")

    start_iso = payload.get("startDateTime") or payload.get("startDateText") or "1970-01-01T00:00:00Z"
    event_timezone = payload.get("timezone")
    event_title = payload.get("eventTitle") or "Untitled Event"
    entry_label = payload.get("entryLabel") or "HOST"
    entry_value = payload.get("hostOrTicketLabel") or payload.get("hostName") or "Unknown Host"
    barcode = _barcode_block(payload)

    rendered_pass = {
        "formatVersion": 1,
        "passTypeIdentifier": existing_pass.get(
            "passTypeIdentifier",
            DEFAULT_PASS_TYPE_IDENTIFIER,
        ),
        "teamIdentifier": existing_pass.get("teamIdentifier", DEFAULT_TEAM_IDENTIFIER),
        "serialNumber": _build_serial_number(existing_pass),
        "organizationName": "Luma",
        "description": event_title,
        "backgroundColor": background,
        "foregroundColor": foreground,
        "labelColor": payload.get("labelColor") or label_color,
        "suppressStripShine": False,
        "eventTicket": {
            "headerFields": [
                _header_datetime_field(start_iso, event_timezone, header_date_format),
            ],
            "primaryFields": [
                {
                    "key": "event",
                    "label": "",
                    "value": event_title,
                }
            ],
            "secondaryFields": [
                {
                    "key": "location",
                    "label": "LOCATION",
                    "value": _format_location(payload),
                }
            ],
            "auxiliaryFields": [
                {
                    "key": "guest",
                    "label": "GUEST",
                    "value": payload.get("guestName") or "Guest",
                },
                {
                    "key": "entry",
                    "label": entry_label,
                    "value": entry_value,
                    "textAlignment": "PKTextAlignmentRight",
                },
            ],
        },
        "barcodes": [barcode],
        "barcode": barcode,
    }

    with PASS_JSON_PATH.open("w", encoding="utf-8") as handle:
        json.dump(rendered_pass, handle, indent=2)
        handle.write("\n")


if __name__ == "__main__":
    main()
