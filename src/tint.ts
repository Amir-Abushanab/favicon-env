import { normalizeBadge } from './badge';
import { defaultDetect } from './detect';
import { hashHue } from './hash';
import type { Badge, EnvFaviconOptions, EnvRule, EnvTint, RuleBadge } from './types';

/** Remembered original favicon href, so repeat calls don't tint an already-tinted icon. */
let originalSource: string | undefined;

function currentIconHref(): string | undefined {
  const links = document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]');
  const last = links.item(links.length - 1);
  return last?.href || undefined;
}

function filterFor(tint: EnvTint): string {
  if (tint.filter) return tint.filter;
  if (typeof tint.hue === 'number') return `hue-rotate(${tint.hue}deg)`;
  return 'none';
}

/** Fill `$1` / `$<name>` placeholders in a template from a regex match. */
function interpolate(template: string, match: RegExpMatchArray): string {
  return template.replace(/\$(?:(\d+)|<([^>]+)>)/g, (_full, index, name) =>
    name == null ? (match[Number(index)] ?? '') : (match.groups?.[name] ?? ''),
  );
}

function resolveRuleBadge(
  badge: string | RuleBadge,
  match: RegExpMatchArray | null,
  url: URL,
): Badge {
  if (typeof badge === 'string') return { color: badge };
  const { text, ...rest } = badge;
  let resolved: string | number | undefined;
  if (typeof text === 'function') resolved = text(match, url);
  else if (typeof text === 'string' && match) resolved = interpolate(text, match);
  else resolved = text;
  return { ...rest, text: resolved };
}

function ruleToTint(rule: EnvRule, match: RegExpMatchArray | null, url: URL): EnvTint {
  const tint: EnvTint = {};
  if (rule.hue != null) tint.hue = rule.hue;
  if (rule.filter) tint.filter = rule.filter;
  if (rule.src) tint.src = rule.src;
  if (rule.badge != null) tint.badge = resolveRuleBadge(rule.badge, match, url);
  return tint;
}

/**
 * Return the tint of the first `rule` whose `match` matches `url`, or `null` if
 * none do. A `RegExp` `match` is tested against `url.host` and its captures are
 * interpolated into `badge.text` (`$1`, `$<name>`); a function `match` receives
 * the `URL`. Exposed so the same rules can drive server-side rendering from a
 * request URL — pair the result with `favicon-env/ssr`'s `faviconDataUri`.
 */
export function matchRules(rules: EnvRule[], url: URL): EnvTint | null {
  for (const rule of rules) {
    if (typeof rule.match === 'function') {
      if (rule.match(url)) return ruleToTint(rule, null, url);
    } else {
      const m = url.host.match(rule.match);
      if (m) return ruleToTint(rule, m, url);
    }
  }
  return null;
}

function resolveTint(options: EnvFaviconOptions): EnvTint | null {
  const url = typeof location === 'undefined' ? null : new URL(location.href);
  if (options.rules && url) {
    const matched = matchRules(options.rules, url);
    if (matched) return matched;
  }
  if (options.auto) {
    const offset = typeof options.auto === 'object' ? (options.auto.offset ?? 0) : 0;
    return { hue: hashHue(url?.host ?? '', offset) };
  }
  const env = (options.detect ?? defaultDetect)();
  const tint = env ? options.environments?.[env] : undefined;
  return tint || null;
}

function inferType(src: string): string | undefined {
  if (src.startsWith('data:')) return /^data:([^;,]+)/.exec(src)?.[1];
  if (/\.svg(?:[?#]|$)/i.test(src)) return 'image/svg+xml';
  if (/\.png(?:[?#]|$)/i.test(src)) return 'image/png';
  if (/\.ico(?:[?#]|$)/i.test(src)) return 'image/x-icon';
  return undefined;
}

function applyFavicon(href: string, type?: string): void {
  document.querySelectorAll('link[rel~="icon"]').forEach((link) => link.remove());
  const link = document.createElement('link');
  link.rel = 'icon';
  if (type) link.type = type;
  link.href = href;
  link.dataset.faviconEnv = '';
  document.head.append(link);
}

function parseRgb(color: string): [number, number, number] | null {
  const hex = /^#([0-9a-f]{6})$/i.exec(color);
  if (hex) {
    const n = Number.parseInt(hex[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const rgb = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/i.exec(color);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  return null;
}

function contrastText(ctx: CanvasRenderingContext2D, background: string): string {
  ctx.fillStyle = background;
  const rgb = parseRgb(ctx.fillStyle); // canvas normalises any CSS colour to #rrggbb / rgba(…)
  if (!rgb) return '#fff';
  const luminance = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;
  return luminance > 0.6 ? '#000' : '#fff';
}

function traceRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function drawBadge(ctx: CanvasRenderingContext2D, size: number, badge: Badge): void {
  const color = badge.color ?? '#ef4444';
  const corner = badge.corner ?? 'bottom-right';
  const text = badge.text == null ? '' : String(badge.text);
  const family = 'system-ui, -apple-system, "Segoe UI", sans-serif';
  const h = Math.round(size * 0.5);
  const margin = Math.round(size * 0.02);
  const maxWidth = size - margin * 2;
  const pad = Math.round(h * 0.5);
  // Circle for a dot / single glyph; a stadium pill widens to fit longer text,
  // shrinking the font if a long label (e.g. a big PR number) would overflow.
  let fontSize = Math.round(h * 0.66);
  ctx.font = `600 ${fontSize}px ${family}`;
  let w = text ? Math.max(h, Math.ceil(ctx.measureText(text).width) + pad) : h;
  if (w > maxWidth) {
    fontSize = Math.max(7, Math.floor(fontSize * (maxWidth / w)));
    ctx.font = `600 ${fontSize}px ${family}`;
    w = Math.min(maxWidth, Math.max(h, Math.ceil(ctx.measureText(text).width) + pad));
  }
  const x = corner.endsWith('left') ? margin : size - w - margin;
  const y = corner.startsWith('top') ? margin : size - h - margin;

  traceRoundRect(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = Math.max(1, size * 0.03);
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.stroke();

  if (text) {
    ctx.fillStyle = badge.textColor ?? contrastText(ctx, color);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + w / 2, y + h / 2);
  }
}

/**
 * Tint / decorate the page favicon for the current environment. Resolves a tint
 * from `rules` (URL match) → `auto` → `environments`/`detect`, then reads the
 * existing `<link rel="icon">` (or a per-env `src` / `options.source`), redraws
 * it on a `<canvas>` with the hue / filter / badge, and swaps in the result as a
 * PNG data URL.
 *
 * A no-op during SSR (no `document`) or when nothing resolves. Works with any
 * favicon format (svg / png / ico). A custom `src` with no recolour or badge is
 * swapped in directly, skipping the canvas — which avoids cross-origin taint and
 * keeps vector sources sharp. If a canvas source is cross-origin without CORS
 * headers the canvas is tainted and the favicon is left untouched.
 *
 * @returns a promise that resolves once the swap has been attempted.
 */
export function envFavicon(options: EnvFaviconOptions = {}): Promise<void> {
  if (typeof document === 'undefined' || typeof HTMLCanvasElement === 'undefined') {
    return Promise.resolve();
  }
  const tint = resolveTint(options);
  if (!tint) return Promise.resolve();

  // Plain image swap: a custom `src` with nothing to composite skips the canvas.
  const needsCanvas = tint.hue != null || Boolean(tint.filter) || Boolean(tint.badge);
  if (!needsCanvas) {
    if (tint.src) applyFavicon(tint.src, inferType(tint.src));
    return Promise.resolve();
  }

  originalSource ??= currentIconHref();
  const source = tint.src ?? options.source ?? originalSource ?? '/favicon.ico';
  const size = options.size ?? 64;

  return new Promise<void>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.addEventListener('error', () => resolve());
    img.addEventListener('load', () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const filter = filterFor(tint);
          if (filter !== 'none') ctx.filter = filter;
          ctx.drawImage(img, 0, 0, size, size);
          ctx.filter = 'none';
          if (tint.badge) drawBadge(ctx, size, normalizeBadge(tint.badge));
          applyFavicon(canvas.toDataURL('image/png'), 'image/png');
        }
      } catch {
        // Tainted canvas (cross-origin source without CORS headers) or an
        // unsupported API — leave the existing favicon in place.
      }
      resolve();
    });
    img.src = source;
  });
}
