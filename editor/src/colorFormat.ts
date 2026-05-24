/** Parse Apple-style pass colors: rgb(), rgba(), or #hex →8-bit RGB */

export function parseColorToRgb(input: string): { r: number; g: number; b: number } | null {
  const s = input.trim()
  if (!s) return null

  const hex = s.match(/^#([\da-f]{3}|[\da-f]{6})$/i)
  if (hex) {
    let h = hex[1]
    if (h.length === 3) {
      h = h
        .split("")
        .map((c) => c + c)
        .join("")
    }
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
    }
  }

  const rgb = s.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i)
  if (rgb) {
    const r = Math.round(Math.min(255, Math.max(0, Number(rgb[1]))))
    const g = Math.round(Math.min(255, Math.max(0, Number(rgb[2]))))
    const b = Math.round(Math.min(255, Math.max(0, Number(rgb[3]))))
    if ([r, g, b].some((n) => Number.isNaN(n))) return null
    return { r, g, b }
  }

  return null
}

export function formatPassRgb(c: { r: number; g: number; b: number }): string {
  return `rgb(${c.r}, ${c.g}, ${c.b})`
}

/** Canonical rgb() string for pass.json / model (fixes picker vs preview mismatch). */
export function normalizePassColor(input: string, fallback = "rgb(0, 0, 0)"): string {
  const c = parseColorToRgb(input)
  return c ? formatPassRgb(c) : fallback
}

export function colorToHexForPicker(input: string, fallback = "#4a5b8e"): string {
  const c = parseColorToRgb(input)
  if (!c) return fallback
  return (
    "#" +
    [c.r, c.g, c.b]
      .map((x) => Math.min(255, Math.max(0, x)).toString(16).padStart(2, "0"))
      .join("")
  )
}

export function hexToPassRgb(hex: string): string {
  const c = parseColorToRgb(hex)
  return c ? formatPassRgb(c) : "rgb(0, 0, 0)"
}
