#!/usr/bin/env python3
"""Palette color derivation tests (run: .venv/bin/python3 scripts/test_palette_colors.py)."""
from __future__ import annotations

import json
import re
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

from render_pass_payload import colors_from_luma_palette  # noqa: E402

FIRESIDE_PALETTE = {
    "neutral": [{"color": "#fefefe", "percentage": 15.46}],
    "vibrant": [
        {"color": "#1d3657", "percentage": 36.51},
        {"color": "#f15308", "percentage": 0.17},
    ],
}

FESTIVAL_PALETTE = {
    "neutral": [{"color": "#002400", "percentage": 69.48}],
    "vibrant": [{"color": "#00ff00", "percentage": 16.59}],
}

PHOTON_PALETTE = {
    "neutral": [
        {"color": "#0d0c0d", "percentage": 22.47},
        {"color": "#acb4b0", "percentage": 8.9},
        {"color": "#9a9c93", "percentage": 11.92},
    ],
    "vibrant": [
        {"color": "#e2a447", "percentage": 1.69},
        {"color": "#fde59a", "percentage": 1.32},
    ],
}

GENZ_PALETTE = {
    "neutral": [{"color": "#f8f9f9", "percentage": 8.82}],
    "vibrant": [
        {"color": "#6b9de1", "percentage": 17.28},
        {"color": "#db90b9", "percentage": 0.94},
        {"color": "#4d4f38", "percentage": 5.74},
    ],
}


class PaletteColorTests(unittest.TestCase):
    def test_fireside_uses_dark_vibrant_navy_background(self) -> None:
        bg, labels = colors_from_luma_palette(FIRESIDE_PALETTE)
        self.assertEqual(bg, "rgb(29, 54, 87)")
        self.assertEqual(labels, "rgb(200, 200, 200)")

    def test_festival_uses_dark_neutral_green_background(self) -> None:
        bg, labels = colors_from_luma_palette(FESTIVAL_PALETTE)
        self.assertEqual(bg, "rgb(0, 36, 0)")
        self.assertEqual(labels, "rgb(0, 255, 0)")

    def test_photon_uses_black_background_and_neutral_grey_labels(self) -> None:
        bg, labels = colors_from_luma_palette(PHOTON_PALETTE)
        self.assertEqual(bg, "rgb(0, 0, 0)")
        self.assertEqual(labels, "rgb(172, 180, 176)")

    def test_genz_darkens_blue_background_and_uses_grey_labels(self) -> None:
        bg, labels = colors_from_luma_palette(GENZ_PALETTE)
        self.assertEqual(bg, "rgb(59, 102, 173)")
        self.assertEqual(labels, "rgb(200, 200, 200)")

    def test_real_luma_html_cover_image_palette(self) -> None:
        for slug, expected_hex in [
            ("4y89vpyu", "#1d3657"),
            ("festival", "#002400"),
        ]:
            path = Path(f"/tmp/luma-{slug}.html")
            if not path.is_file():
                self.skipTest(f"missing {path} (fetch Luma page first)")
            html = path.read_text(encoding="utf-8")
            match = re.search(
                r'<script id="__NEXT_DATA__" type="application/json">(.+?)</script>',
                html,
            )
            self.assertIsNotNone(match, slug)
            root = json.loads(match.group(1))["props"]["pageProps"]["initialData"]["data"]
            palette = root["cover_image"]["palette"]
            bg, _ = colors_from_luma_palette(palette)
            r, g, b = [int(part.strip()) for part in bg[4:-1].split(",")]
            self.assertEqual(f"#{r:02x}{g:02x}{b:02x}", expected_hex, slug)


if __name__ == "__main__":
    unittest.main()
