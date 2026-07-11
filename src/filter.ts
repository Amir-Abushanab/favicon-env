import type { EnvTint } from './types';

/** The CSS `filter` for a tint — an explicit `filter` beats `hue`; `null` if neither is set. */
export function cssFilter(tint: EnvTint): string | null {
  if (tint.filter) return tint.filter;
  if (typeof tint.hue === 'number') return `hue-rotate(${tint.hue}deg)`;
  return null;
}
