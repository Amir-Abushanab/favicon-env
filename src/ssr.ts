import { badgeText, DEFAULT_BADGE_COLOR, normalizeBadge, placeBadge } from './badge';
import { contrastColor } from './color';
import { cssFilter } from './filter';
import type { Badge, EnvConfig } from './types';

const XML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => XML_ESCAPES[c] ?? c);
}

const round = (n: number): number => Math.round(n * 100) / 100;

/** ` opacity="…"` attribute for a translucent badge group, else `''`. */
function opacityAttr(badge: Badge): string {
  return (badge.opacity ?? 1) < 1 ? ` opacity="${round(badge.opacity ?? 1)}"` : '';
}

/** Attributes that squeeze the glyphs into `len` when the natural text would overflow. */
function fitText(len: number): string {
  return ` textLength="${round(len)}" lengthAdjust="spacingAndGlyphs"`;
}

/** A centred, bold `<text>` element at (`cx`, `cy`) — the one badge-label form. */
function svgText(
  cx: number,
  cy: number,
  fill: string,
  fontSize: number,
  fit: string,
  text: string,
): string {
  return (
    `<text x="${round(cx)}" y="${round(cy)}" fill="${escapeXml(fill)}" ` +
    `font-family="system-ui, sans-serif" font-size="${round(fontSize)}" font-weight="700" ` +
    `text-anchor="middle" dominant-baseline="central"${fit}>${escapeXml(text)}</text>`
  );
}

/** Read the drawable box from a root `<svg>` tag: its `viewBox`, else `width`/`height`. */
function parseViewBox(openTag: string): [number, number, number, number] | null {
  const vb = /viewBox\s*=\s*["']([^"']+)["']/i.exec(openTag);
  if (vb) {
    const parts = vb[1]
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    if (parts.length === 4 && parts.every((n) => !Number.isNaN(n))) {
      return [parts[0], parts[1], parts[2], parts[3]];
    }
  }
  const w = /\bwidth\s*=\s*["']?([\d.]+)/i.exec(openTag);
  const h = /\bheight\s*=\s*["']?([\d.]+)/i.exec(openTag);
  if (w && h) return [0, 0, Number(w[1]), Number(h[1])];
  return null;
}

/** Build an SVG `<g>` badge (dot, or a pill with text) sized to the viewBox. */
function svgBadge([minX, minY, w, h]: [number, number, number, number], badge: Badge): string {
  const text = badgeText(badge);
  const color = badge.color ?? DEFAULT_BADGE_COLOR;
  const corner = badge.corner ?? 'bottom-right';
  const bh = h * (badge.size ?? 0.5);
  const fontSize = bh * 0.62;
  const margin = w * 0.02;
  // SVG has no text metrics at build time; approximate glyph width at ~0.62em,
  // then clamp to the icon so a long label (e.g. a big PR number) can't overflow.
  const natural = text ? Math.max(bh, text.length * fontSize * 0.62 + bh * 0.5) : bh;
  const bw = text ? Math.min(natural, w - margin * 2) : bh;
  const [px, py] = placeBadge(corner, w, h, bw, bh, margin);
  const x = minX + px;
  const y = minY + py;
  const rx = text ? Math.min(bh / 2, w * 0.24) : bh / 2;
  // If clamped, force the glyphs to fit the pill width.
  const fit = bw < natural ? fitText(bw - bh * 0.4) : '';
  const label = text
    ? svgText(x + bw / 2, y + bh / 2, badge.textColor ?? contrastColor(color), fontSize, fit, text)
    : '';
  return (
    `<g${opacityAttr(badge)}><rect x="${round(x)}" y="${round(y)}" width="${round(bw)}" height="${round(bh)}" ` +
    `rx="${round(rx)}" fill="${escapeXml(color)}" stroke="rgba(0,0,0,0.35)" ` +
    `stroke-width="${round(h * 0.015)}"/>${label}</g>`
  );
}

/** Build a full-icon "cover" tile — a background rect plus a big centred number. */
function svgCover([minX, minY, w, h]: [number, number, number, number], badge: Badge): string {
  const color = badge.color ?? DEFAULT_BADGE_COLOR;
  const text = badgeText(badge);
  const side = Math.min(w, h);
  const op = opacityAttr(badge);
  const rect =
    `<rect x="${round(minX)}" y="${round(minY)}" width="${round(w)}" height="${round(h)}" ` +
    `rx="${round(side * 0.2)}" fill="${escapeXml(color)}"/>`;
  if (!text) return `<g${op}>${rect}</g>`;
  const fontSize = side * 0.62;
  const maxLen = w * 0.84;
  const fit = text.length * fontSize * 0.62 > maxLen ? fitText(maxLen) : '';
  const label = svgText(
    minX + w / 2,
    minY + h / 2,
    badge.textColor ?? contrastColor(color),
    fontSize,
    fit,
    text,
  );
  return `<g${op}>${rect}${label}</g>`;
}

/**
 * Return `svg` (an SVG *string*) with the environment's tint and/or badge baked
 * in — the form that survives being rendered as an `<img>` / favicon, with no
 * first-paint flash. The tint is a CSS `filter` on a wrapping group; the badge
 * is an appended `<g>` positioned via the SVG's `viewBox` (a badge is skipped if
 * no `viewBox` or `width`/`height` can be read).
 *
 * Returns the SVG unchanged when `tint` is falsy, has nothing to apply, or the
 * input isn't a recognisable `<svg>…</svg>` document.
 */
export function tintSvg(svg: string, tint: EnvConfig): string {
  if (!tint) return svg;
  const filter = cssFilter(tint);
  const badge = tint.badge ? normalizeBadge(tint.badge) : null;
  if (!filter && !badge) return svg;
  const open = /<svg\b[^>]*>/i.exec(svg);
  if (!open) return svg;
  const close = svg.lastIndexOf('</svg>');
  if (close === -1) return svg;
  const openEnd = open.index + open[0].length;

  // `shape: 'cover'` replaces the icon's content with a full-bleed number tile.
  // A translucent cover (opacity < 1) keeps the base showing through instead.
  if (badge?.shape === 'cover') {
    const vb = parseViewBox(open[0]);
    if (!vb) return svg;
    const base = (badge.opacity ?? 1) < 1 ? svg.slice(openEnd, close) : '';
    return `${svg.slice(0, openEnd)}${base}${svgCover(vb, badge)}${svg.slice(close)}`;
  }

  const inner = svg.slice(openEnd, close);
  // No XML comments injected here — XML comments may not contain `--`, which
  // every `--custom-property` does, and that silently breaks favicon SVGs.
  const style = filter ? `<style>.__favenv{filter:${filter}}</style>` : '';
  const body = filter ? `<g class="__favenv">${inner}</g>` : inner;
  const viewBox = badge ? parseViewBox(open[0]) : null;
  const badgeSvg = badge && viewBox ? svgBadge(viewBox, badge) : '';
  return `${svg.slice(0, openEnd)}${style}${body}${badgeSvg}${svg.slice(close)}`;
}

/** Percent-encode an SVG string as a `data:` URI suitable for a favicon `href`. */
export function svgToDataUri(svg: string): string {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/**
 * Convenience: `tintSvg` + `svgToDataUri`. Give it your favicon SVG and the
 * config for the current build's environment; get back a ready-to-use
 * `<link rel="icon" href="…">` value with no first-paint flash.
 */
export function faviconDataUri(svg: string, tint: EnvConfig): string {
  return svgToDataUri(tintSvg(svg, tint));
}
