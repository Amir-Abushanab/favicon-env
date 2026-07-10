/**
 * Deterministic hue (0–359) derived from a string via FNV-1a. Stable across
 * loads and well distributed, so distinct inputs (e.g. `location.host` values)
 * get distinct colours. Powers `envFavicon`'s auto mode.
 *
 * @param input  the string to hash (e.g. `location.host`)
 * @param offset extra degrees added to the result, to shift the whole palette
 */
export function hashHue(input: string, offset = 0): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (((h >>> 0) % 360) + (offset % 360) + 360) % 360;
}
