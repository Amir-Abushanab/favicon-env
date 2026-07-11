import type { Badge, BadgeCorner } from './types';

/** Default badge background — the red dot/pill you get when no `color` is set. */
export const DEFAULT_BADGE_COLOR = '#ef4444';

/** Normalise the `badge` shorthand (a `string` is a dot of that colour) to a `Badge`. */
export function normalizeBadge(badge: string | Badge): Badge {
  return typeof badge === 'string' ? { color: badge } : badge;
}

/** A badge's text as a string (`''` when omitted) — so a `0` renders and `undefined` doesn't. */
export function badgeText(badge: Badge): string {
  return badge.text == null ? '' : String(badge.text);
}

/**
 * Top-left corner for a `bw`×`bh` badge inside a `cw`×`ch` box, per `corner`
 * (relative to the box origin; the caller adds any offset). Shared by the canvas
 * and SVG renderers so placement stays identical across runtime and build-time.
 */
export function placeBadge(
  corner: BadgeCorner,
  cw: number,
  ch: number,
  bw: number,
  bh: number,
  margin: number,
): [number, number] {
  if (corner === 'center') return [(cw - bw) / 2, (ch - bh) / 2];
  return [
    corner.endsWith('left') ? margin : cw - bw - margin,
    corner.startsWith('top') ? margin : ch - bh - margin,
  ];
}
