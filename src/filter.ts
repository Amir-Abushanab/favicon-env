import type { EnvTint } from './types';

/**
 * The CSS `filter` for a tint. An explicit `filter` wins outright; otherwise
 * `hue` and `invert` compose into one filter string (both applied, in that
 * order). `null` when none of them are set.
 */
export function cssFilter(tint: EnvTint): string | null {
  if (tint.filter) return tint.filter;
  const parts: string[] = [];
  if (typeof tint.hue === 'number') parts.push(`hue-rotate(${tint.hue}deg)`);
  // `invert: true` → invert(1); a number is used verbatim. `0` / `false` is a no-op.
  if (tint.invert) parts.push(`invert(${tint.invert === true ? 1 : tint.invert})`);
  return parts.length > 0 ? parts.join(' ') : null;
}
