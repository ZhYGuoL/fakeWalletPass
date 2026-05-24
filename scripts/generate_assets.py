#!/usr/bin/env python3
"""Generate Wallet icons and logo from a repo wordmark PNG (transparent RGBA)."""

from __future__ import annotations

from pathlib import Path

from PIL import Image

PASS_DIR = Path(__file__).resolve().parent.parent / "pass"
ROOT = Path(__file__).resolve().parent.parent
# Prefer project-root Anthropic (or other) wordmark; then pass-local assets.
WORDMARK_CANDIDATES = (
    ROOT / "Logo.png",
    PASS_DIR / "luma_logo.png",
    PASS_DIR / "anthropic_logo.png",
)
LUMA_FALLBACK_GLOB = "Screenshot*.png"


def _wordmark_source_path() -> Path:
    for p in WORDMARK_CANDIDATES:
        if p.is_file():
            return p
    matches = sorted(ROOT.glob(LUMA_FALLBACK_GLOB))
    if matches:
        return matches[0]
    raise SystemExit(
        f"Add Logo.png at repo root or pass/luma_logo.png. Tried: "
        + ", ".join(str(p) for p in WORDMARK_CANDIDATES)
    )


def _strip_background(im: Image.Image, tolerance: int = 38) -> Image.Image:
    im = im.convert("RGBA")
    bg = im.getpixel((0, 0))[:3]
    out = []
    for px in im.getdata():
        if all(abs(px[i] - bg[i]) <= tolerance for i in range(3)):
            out.append((255, 255, 255, 0))
        else:
            out.append(px)
    out_im = Image.new("RGBA", im.size)
    out_im.putdata(out)
    return out_im


def _scale_height(im: Image.Image, target_h: int) -> Image.Image:
    if im.height <= 0:
        return im
    ratio = target_h / im.height
    w = max(1, int(im.width * ratio))
    return im.resize((w, target_h), Image.Resampling.LANCZOS)


def build_icons(mark: Image.Image) -> None:
    for name, px in (("icon.png", 29), ("icon@2x.png", 58), ("icon@3x.png", 87)):
        canvas = Image.new("RGBA", (px, px), (0, 0, 0, 0))
        m = _scale_height(mark, int(px * 0.72))
        x = (px - m.width) // 2
        y = (px - m.height) // 2
        canvas.paste(m, (x, y), m)
        canvas.save(PASS_DIR / name, format="PNG")


def build_logo_strips(mark: Image.Image) -> None:
    """Header strip: wordmark only. Wallet centers logo in header — do not bake time/date here."""
    for scale, suffix in ((1, ""), (2, "@2x"), (3, "@3x")):
        h = 50 * scale
        m = _scale_height(mark, h)
        max_w = int(160 * scale)
        if m.width > max_w:
            r = max_w / m.width
            m = m.resize((max_w, max(1, int(m.height * r))), Image.Resampling.LANCZOS)
        w = max(m.width + 4 * scale, 80 * scale)
        canvas = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        y = (h - m.height) // 2
        canvas.paste(m, (0, y), m)
        canvas.save(PASS_DIR / f"logo{suffix}.png", format="PNG")


def _prepare_wordmark(im: Image.Image) -> Image.Image:
    """Keep true RGBA transparency; only chroma-strip fully opaque images (e.g. screenshots)."""
    im = im.convert("RGBA")
    alpha_ext = im.split()[3].getextrema()
    if alpha_ext != (255, 255):
        return im
    return _strip_background(im)


def main() -> None:
    src = _wordmark_source_path()
    raw = Image.open(src).convert("RGBA")
    mark = _prepare_wordmark(raw)

    PASS_DIR.mkdir(parents=True, exist_ok=True)
    build_icons(mark)
    build_logo_strips(mark)

    print("Wrote icons and logo from", src, "into", PASS_DIR)


if __name__ == "__main__":
    main()
