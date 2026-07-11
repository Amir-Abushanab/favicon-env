import { badgeText, DEFAULT_BADGE_COLOR, normalizeBadge, placeBadge } from './badge';
import { contrastColor } from './color';
import { defaultDetect } from './detect';
import { cssFilter } from './filter';
import { hashHue } from './hash';
import type { Badge, EnvFaviconOptions, EnvRule, EnvTint, RuleBadge } from './types';

/** Selector for the favicon `<link>`(s) we read from and replace. */
const ICON_LINK = 'link[rel~="icon"]';

/** Remembered original favicon href, so repeat calls don't tint an already-tinted icon. */
let originalSource: string | undefined;

function currentIconHref(): string | undefined {
  const links = document.querySelectorAll<HTMLLinkElement>(ICON_LINK);
  const last = links.item(links.length - 1);
  return last?.href || undefined;
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
  document.querySelectorAll(ICON_LINK).forEach((link) => link.remove());
  const link = document.createElement('link');
  link.rel = 'icon';
  if (type) link.type = type;
  link.href = href;
  link.dataset.faviconEnv = '';
  document.head.append(link);
}

function contrastText(ctx: CanvasRenderingContext2D, background: string): string {
  ctx.fillStyle = background; // canvas normalises any CSS colour to #rrggbb / rgba(…)
  return contrastColor(ctx.fillStyle);
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
  const color = badge.color ?? DEFAULT_BADGE_COLOR;
  const text = badgeText(badge);
  const family = 'system-ui, -apple-system, "Segoe UI", sans-serif';

  // `shape: 'cover'` fills the whole icon and centres the number as big as it fits.
  if (badge.shape === 'cover') {
    traceRoundRect(ctx, 0, 0, size, size, Math.round(size * 0.2));
    ctx.fillStyle = color;
    ctx.fill();
    if (text) {
      const maxWidth = size * 0.84;
      let fontSize = Math.round(size * 0.62);
      ctx.font = `700 ${fontSize}px ${family}`;
      const textWidth = ctx.measureText(text).width;
      if (textWidth > maxWidth) {
        fontSize = Math.max(7, Math.floor(fontSize * (maxWidth / textWidth)));
        ctx.font = `700 ${fontSize}px ${family}`;
      }
      ctx.fillStyle = badge.textColor ?? contrastText(ctx, color);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, size / 2, size / 2);
    }
    return;
  }

  const corner = badge.corner ?? 'bottom-right';
  const h = Math.round(size * (badge.size ?? 0.5));
  const margin = Math.round(size * 0.02);
  const maxWidth = size - margin * 2;
  const pad = Math.round(h * 0.5);
  // A dot / short label sits in a pill that widens (then the font shrinks) to fit
  // longer text. Bump badge.size + corner:'center' to make a number dominate.
  let fontSize = Math.round(h * 0.66);
  ctx.font = `700 ${fontSize}px ${family}`;
  let w = text ? Math.max(h, Math.ceil(ctx.measureText(text).width) + pad) : h;
  if (w > maxWidth) {
    fontSize = Math.max(7, Math.floor(fontSize * (maxWidth / w)));
    ctx.font = `700 ${fontSize}px ${family}`;
    w = Math.min(maxWidth, Math.max(h, Math.ceil(ctx.measureText(text).width) + pad));
  }
  const [px, py] = placeBadge(corner, size, size, w, h, margin);
  const x = Math.round(px);
  const y = Math.round(py);
  const radius = text ? Math.min(h / 2, size * 0.24) : h / 2;

  traceRoundRect(ctx, x, y, w, h, radius);
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

  const badge = tint.badge != null ? normalizeBadge(tint.badge) : undefined;
  const size = options.size ?? 64;
  const cover = badge?.shape === 'cover';
  const alpha = badge?.opacity ?? 1;

  // An opaque `cover` replaces the icon entirely — no base image needed, so draw
  // it synchronously. A translucent cover falls through to composite over the base.
  if (cover && alpha >= 1) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      drawBadge(ctx, size, badge);
      applyFavicon(canvas.toDataURL('image/png'), 'image/png');
    }
    return Promise.resolve();
  }

  // Plain image swap: a custom `src` with nothing to composite skips the canvas.
  const needsCanvas = tint.hue != null || Boolean(tint.filter) || Boolean(badge);
  if (!needsCanvas) {
    if (tint.src) applyFavicon(tint.src, inferType(tint.src));
    return Promise.resolve();
  }

  originalSource ??= currentIconHref();
  const source = tint.src ?? options.source ?? originalSource ?? '/favicon.ico';

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
          // `cover` ignores the hue/filter (it's replacing the icon); a plain tint
          // applies it to the base. The base is always drawn here — a translucent
          // cover shows it through.
          if (!cover) {
            const filter = cssFilter(tint);
            if (filter) ctx.filter = filter;
          }
          ctx.drawImage(img, 0, 0, size, size);
          ctx.filter = 'none';
          if (badge) {
            ctx.globalAlpha = alpha;
            drawBadge(ctx, size, badge);
            ctx.globalAlpha = 1;
          }
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
