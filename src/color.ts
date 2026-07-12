/** Parse `#rgb` / `#rrggbb` / `rgb(…)` / `rgba(…)` into `[r, g, b]` (0–255), or `null`. */
function parseRgb(color: string): [number, number, number] | null {
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color);
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].replace(/./g, (c) => c + c) : hex[1];
    const n = Number.parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const rgb = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/i.exec(color);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  return null;
}

/**
 * Perceived lightness (0–1) of `color` for the black/white text decision:
 * rec601 luma for `#hex` / `rgb()`, or the `L` channel of CSS Color 4 colours —
 * `oklch()`/`oklab()` (0–1) and `lab()`/`lch()` (0–100). `null` if unreadable.
 */
function lightness(color: string): number | null {
  const rgb = parseRgb(color);
  if (rgb) return (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;
  const lch = /^(okl(?:ch|ab)|l(?:ch|ab))\(\s*([\d.]+)(%?)/i.exec(color);
  if (lch) {
    const l = Number(lch[2]);
    if (lch[3]) return l / 100; // a percentage L, in any of these spaces
    return /^ok/i.test(lch[1]) ? l : l / 100; // oklab/oklch L is 0–1, lab/lch is 0–100
  }
  return null;
}

/**
 * Black or white — whichever reads better on `color` — by perceived lightness.
 * Handles `#hex`, `rgb()`, and CSS Color 4 `oklch()`/`oklab()`/`lab()`/`lch()`;
 * falls back to white for anything else (named colours, `hsl()`, `color()`, …).
 */
export function contrastColor(color: string): string {
  const l = lightness(color);
  if (l == null) return '#fff';
  return l > 0.6 ? '#000' : '#fff';
}
