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
 * Black or white — whichever reads better on `color` — by perceived luminance.
 * Falls back to white for colours it can't parse (named / `hsl()` / etc.).
 */
export function contrastColor(color: string): string {
  const rgb = parseRgb(color);
  if (!rgb) return '#fff';
  const luminance = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;
  return luminance > 0.6 ? '#000' : '#fff';
}
