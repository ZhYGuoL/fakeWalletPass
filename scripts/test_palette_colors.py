#!/usr/bin/env python3
"""Palette color derivation tests (run: .venv/bin/python3 scripts/test_palette_colors.py).

Anchored on eight real Luma-generated .pkpass files. Their exact colors pinned
down the deterministic rule (see render_pass_payload.colors_from_luma_palette):
  - background = highest-percentage cover swatch, HSL lightness clamped [10%,40%]
  - label      = HSL lightness 80%, hue/sat from the top vibrant when it is a
                 real accent (>=3% and lightness >=35%), else from the lightest
                 covering neutral (grey or cream)
  - foreground = white
"""
from __future__ import annotations

import re
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

from render_pass_payload import colors_from_luma_palette  # noqa: E402


def _hex(rgb_string: str) -> str:
    r, g, b = (int(part) for part in re.findall(r"\d+", rgb_string))
    return f"#{r:02x}{g:02x}{b:02x}"


def _max_channel_delta(a: str, b: str) -> int:
    ra = [int(a[i : i + 2], 16) for i in (1, 3, 5)]
    rb = [int(b[i : i + 2], 16) for i in (1, 3, 5)]
    return max(abs(x - y) for x, y in zip(ra, rb))


# (name, palette, real_background, real_label). Palettes pulled live from each
# event's Luma page; the real colors are read from the produced .pkpass.
REAL_PASSES = [
    (
        "agent_ctos",  # no vibrant -> grey label
        {"neutral": [{"color": "#ffffff", "percentage": 90.16},
                     {"color": "#121212", "percentage": 2.77},
                     {"color": "#202020", "percentage": 1.51}],
         "vibrant": []},
        "#666666", "#cccccc",
    ),
    (
        "sonder_lemma",  # strong red vibrant -> pink label
        {"neutral": [{"color": "#ededed", "percentage": 61.0}],
         "vibrant": [{"color": "#be2020", "percentage": 4.18},
                     {"color": "#dba28c", "percentage": 3.18}]},
        "#666666", "#f0a8a8",
    ),
    (
        "canopy_festival",  # neon green vibrant -> light green label
        {"neutral": [{"color": "#002400", "percentage": 69.48}],
         "vibrant": [{"color": "#00ff00", "percentage": 16.59}]},
        "#003300", "#99ff99",
    ),
    (
        "jachacks",  # vibrant too rare (0.91%) -> cream neutral label
        {"neutral": [{"color": "#0c0a0c", "percentage": 31.83},
                     {"color": "#ede2cb", "percentage": 1.24}],
         "vibrant": [{"color": "#ee6e28", "percentage": 0.91}]},
        "#1c171c", "#e5d5b3",
    ),
    (
        "tavus",  # strong orange vibrant -> peach label
        {"neutral": [{"color": "#0d0001", "percentage": 53.01},
                     {"color": "#fffdfc", "percentage": 1.06}],
         "vibrant": [{"color": "#f26625", "percentage": 26.23},
                     {"color": "#fe5075", "percentage": 11.54}]},
        "#330004", "#f9bb9f",
    ),
    (
        "the_view",  # vibrant present (5.3%) but too dark (L=26%) -> grey label
        {"neutral": [{"color": "#050202", "percentage": 30.73},
                     {"color": "#dfd1ae", "percentage": 3.65},
                     {"color": "#736563", "percentage": 11.12}],
         "vibrant": [{"color": "#6d311a", "percentage": 5.33}]},
        "#240f0f", "#d0c9c8",
    ),
]


class RealPassColorTests(unittest.TestCase):
    def test_exact_matches(self) -> None:
        for name, palette, real_bg, real_label in REAL_PASSES:
            with self.subTest(name):
                bg, label = colors_from_luma_palette(palette)
                self.assertEqual(_hex(bg), real_bg, f"{name} background")
                self.assertEqual(_hex(label), real_label, f"{name} label")

    def test_near_grey_label_within_tolerance(self) -> None:
        # Sonder Listening Room: no vibrant; picks the dominant light-neutral.
        # The chosen grey lands within a few levels of the real #cdcdcb.
        palette = {
            "neutral": [{"color": "#f4f3f1", "percentage": 84.56},
                        {"color": "#ececeb", "percentage": 1.69},
                        {"color": "#a1a29d", "percentage": 1.64}],
            "vibrant": [],
        }
        bg, label = colors_from_luma_palette(palette)
        self.assertEqual(_hex(bg), "#726a5a")
        self.assertLessEqual(_max_channel_delta(_hex(label), "#cdcdcb"), 8)

    def test_empty_palette(self) -> None:
        self.assertEqual(colors_from_luma_palette(None), (None, None))
        self.assertEqual(colors_from_luma_palette({}), (None, None))


if __name__ == "__main__":
    unittest.main()
