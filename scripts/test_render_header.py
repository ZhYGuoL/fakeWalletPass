#!/usr/bin/env python3
"""Header date/time layout tests (run: .venv/bin/python3 scripts/test_render_header.py)."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

from render_pass_payload import (  # noqa: E402
    PASS_STYLE_OVERRIDES,
    _format_header_date_text,
    _format_header_time_label,
    _format_location,
    _header_datetime_field,
    _luma_event_slug,
)


class RenderHeaderTests(unittest.TestCase):
    def test_time_label_uses_event_timezone(self) -> None:
        label = _format_header_time_label(
            "2026-06-15T01:00:00.000Z",
            "America/Los_Angeles",
        )
        self.assertEqual(label, "6:00 PM")

    def test_single_header_field_stacks_time_over_date(self) -> None:
        field = _header_datetime_field(
            "2026-06-15T01:00:00.000Z",
            "America/Los_Angeles",
        )
        self.assertEqual(field["label"], "6:00 PM")
        self.assertEqual(field["value"], "2026-06-15T01:00:00.000Z")
        self.assertEqual(field["dateStyle"], "PKDateStyleMedium")
        self.assertEqual(field["timeStyle"], "PKDateStyleNone")
        self.assertEqual(field["textAlignment"], "PKTextAlignmentRight")

    def test_genz_day_first_date_matches_real_pass(self) -> None:
        text = _format_header_date_text(
            "2026-05-24T19:00:00.000Z",
            "America/Los_Angeles",
            "day_first",
        )
        self.assertEqual(text, "24 May 2026")

    def test_photon_us_medium_date_matches_real_pass(self) -> None:
        text = _format_header_date_text(
            "2026-05-24T19:00:00.000Z",
            "America/Los_Angeles",
            "us_medium",
        )
        self.assertEqual(text, "May 24, 2026")

    def test_byobhyun_override_uses_text_date_not_pkdatestyle(self) -> None:
        field = _header_datetime_field(
            "2026-05-24T19:00:00.000Z",
            "America/Los_Angeles",
            PASS_STYLE_OVERRIDES["byobhyun"]["headerDateFormat"],
        )
        self.assertEqual(field["value"], "24 May 2026")
        self.assertNotIn("dateStyle", field)

    def test_luma_event_slug_from_url(self) -> None:
        self.assertEqual(
            _luma_event_slug("https://luma.com/byobhyun?tk=abc"),
            "byobhyun",
        )
        self.assertEqual(
            _luma_event_slug("https://luma.com/qifsyhwo?tk=AxudZJ"),
            "qifsyhwo",
        )

    def test_location_uses_address_only_not_venue_prefix(self) -> None:
        value = _format_location(
            {
                "locationName": "Yerba Buena",
                "address": "880 Harrison St",
            }
        )
        self.assertEqual(value, "880 Harrison St")

    def test_style_override_background_colors(self) -> None:
        self.assertEqual(
            PASS_STYLE_OVERRIDES["byobhyun"]["backgroundColor"],
            "rgb(50, 91, 165)",
        )
        self.assertEqual(
            PASS_STYLE_OVERRIDES["qifsyhwo"]["backgroundColor"],
            "rgb(26, 24, 27)",
        )


if __name__ == "__main__":
    unittest.main()
