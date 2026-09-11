/**
 * CSS `filter` functions re-expressed as colour matrices — the one form every
 * engine can apply.
 *
 * Two engine gaps make this necessary, and they are independent:
 *   1. WebKit/Safari does not implement `CanvasRenderingContext2D.filter` at all
 *      (`'filter' in ctx` is `false`), so assigning it is a silent no-op and the
 *      runtime path draws the icon untinted.
 *   2. WebKit also ignores a CSS `filter` set on an *inner* SVG element, so the
 *      SSR path can't wrap the artwork in a filtered `<g>` either. A real SVG
 *      `<filter>` element is honoured everywhere.
 *
 * Each matrix is 20 numbers in `feColorMatrix` row-major order (4 rows × 5
 * columns, the last column a constant), and a filter string becomes a *list* of
 * them applied in sequence — not one pre-multiplied matrix — because the Filter
 * Effects spec clamps every primitive's result to 0–1 before the next one runs,
 * and `hue-rotate` routinely overflows that range.
 */

/** 4×5 colour matrix, row-major, in `feColorMatrix` `values` order. */
export type ColorMatrix = readonly number[];

/** One output channel: the r/g/b coefficients plus a constant. */
type Row = readonly [number, number, number, number];

const rgbRow = (row: Row): number[] => [row[0], row[1], row[2], 0, row[3]];

/**
 * Assemble the three colour rows into a full matrix. No colour function reads
 * the alpha channel, so that column is always 0; `alpha` scales alpha itself.
 */
function matrix(r: Row, g: Row, b: Row, alpha = 1): ColorMatrix {
  return [...rgbRow(r), ...rgbRow(g), ...rgbRow(b), 0, 0, 0, alpha, 0];
}

// The luminance coefficients the Filter Effects spec uses for `saturate` and
// `hue-rotate` (not the same set as `feColorMatrix type="luminanceToAlpha"`).
const [LR, LG, LB] = [0.213, 0.715, 0.072];

function saturate(s: number): ColorMatrix {
  return matrix(
    [LR + 0.787 * s, LG - LG * s, LB - LB * s, 0],
    [LR - LR * s, LG + 0.285 * s, LB - LB * s, 0],
    [LR - LR * s, LG - LG * s, LB + 0.928 * s, 0],
  );
}

function hueRotate(deg: number): ColorMatrix {
  const rad = (deg * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return matrix(
    [LR + c * 0.787 - s * 0.213, LG - c * 0.715 - s * 0.715, LB - c * 0.072 + s * 0.928, 0],
    [LR - c * 0.213 + s * 0.143, LG + c * 0.285 + s * 0.14, LB - c * 0.072 - s * 0.283, 0],
    [LR - c * 0.213 - s * 0.787, LG - c * 0.715 + s * 0.715, LB + c * 0.928 + s * 0.072, 0],
  );
}

/** `sepia(a)` — a linear blend from the identity (`a = 0`) to the spec's matrix. */
function sepia(a: number): ColorMatrix {
  const k = 1 - a;
  return matrix(
    [k + 0.393 * a, 0.769 * a, 0.189 * a, 0],
    [0.349 * a, k + 0.686 * a, 0.168 * a, 0],
    [0.272 * a, 0.534 * a, k + 0.131 * a, 0],
  );
}

/** `invert(a)`: `c' = a + c * (1 - 2a)` — affine, so the constant column carries `a`. */
function invert(a: number): ColorMatrix {
  const k = 1 - 2 * a;
  return matrix([k, 0, 0, a], [0, k, 0, a], [0, 0, k, a]);
}

/** A per-channel `slope`/`intercept` ramp — `brightness` and `contrast` both reduce to one. */
function linear(slope: number, intercept: number): ColorMatrix {
  return matrix([slope, 0, 0, intercept], [0, slope, 0, intercept], [0, 0, slope, intercept]);
}

function opacity(o: number): ColorMatrix {
  return matrix([1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], o);
}

/** Parse one filter-function argument. `%` is divided out; a bare number is used as-is. */
function amount(raw: string, fallback: number): number | null {
  const text = raw.trim();
  if (text === '') return fallback;
  const m = /^([+-]?(?:\d+\.?\d*|\.\d+))(%?)$/.exec(text);
  if (!m) return null;
  const n = Number(m[1]);
  return m[2] ? n / 100 : n;
}

/** Parse a `<angle>` for `hue-rotate` — `deg` (default), `rad`, `grad` or `turn`. */
function angle(raw: string): number | null {
  const text = raw.trim();
  if (text === '') return 0;
  const m = /^([+-]?(?:\d+\.?\d*|\.\d+))(deg|rad|grad|turn)?$/.exec(text);
  if (!m) return null;
  const n = Number(m[1]);
  if (m[2] === 'rad') return (n * 180) / Math.PI;
  if (m[2] === 'grad') return n * 0.9;
  if (m[2] === 'turn') return n * 360;
  return n;
}

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

/**
 * Every CSS filter function that is a pure colour transform, with the argument
 * defaults and clamps CSS gives it. `blur()` and `drop-shadow()` are
 * deliberately absent — they move pixels around, so they can't be a matrix, and
 * a string containing one falls back to the CSS path.
 */
const FUNCTIONS: Record<string, (raw: string) => ColorMatrix | null> = {
  'hue-rotate': (raw) => {
    const deg = angle(raw);
    return deg == null ? null : hueRotate(deg);
  },
  // grayscale(a) is exactly saturate(1 - a).
  grayscale: (raw) => {
    const a = amount(raw, 1);
    return a == null ? null : saturate(1 - clamp01(a));
  },
  sepia: (raw) => {
    const a = amount(raw, 1);
    return a == null ? null : sepia(clamp01(a));
  },
  saturate: (raw) => {
    const a = amount(raw, 1);
    return a == null || a < 0 ? null : saturate(a);
  },
  invert: (raw) => {
    const a = amount(raw, 1);
    return a == null ? null : invert(clamp01(a));
  },
  opacity: (raw) => {
    const a = amount(raw, 1);
    return a == null ? null : opacity(clamp01(a));
  },
  brightness: (raw) => {
    const a = amount(raw, 1);
    return a == null || a < 0 ? null : linear(a, 0);
  },
  contrast: (raw) => {
    const a = amount(raw, 1);
    return a == null || a < 0 ? null : linear(a, 0.5 - 0.5 * a);
  },
};

const FUNCTION_RE = /([a-z-]+)\(([^()]*)\)/gi;

/**
 * Turn a CSS `filter` string into the chain of colour matrices that computes it,
 * or `null` if any part of it isn't a colour transform (`blur`, `drop-shadow`,
 * `url(#…)`, a typo). `'none'` and an empty string yield an empty chain.
 *
 * Callers treat `null` as "only a native implementation can do this" — the
 * runtime path leaves the icon untouched, the SSR path emits a CSS `filter` as
 * it did before.
 */
export function filterMatrices(filter: string): ColorMatrix[] | null {
  const matrices: ColorMatrix[] = [];
  FUNCTION_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = FUNCTION_RE.exec(filter)) !== null) {
    const build = FUNCTIONS[m[1].toLowerCase()];
    if (!build) return null;
    const built = build(m[2]);
    if (!built) return null;
    matrices.push(built);
  }
  // Reject anything the scan didn't account for (bar whitespace), so a
  // half-understood string can't silently apply half a filter.
  const rest = filter.replace(FUNCTION_RE, '').trim();
  if (rest !== '' && rest !== 'none') return null;
  return matrices;
}

/**
 * Apply a matrix chain to raw `ImageData` bytes, in place. Values are
 * non-premultiplied on both sides (what `getImageData` hands back, and what
 * `feColorMatrix` is defined over), and `Uint8ClampedArray` supplies the
 * per-primitive clamp for free.
 */
export function applyMatrices(data: Uint8ClampedArray, matrices: readonly ColorMatrix[]): void {
  for (const m of matrices) {
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i] / 255;
      const g = data[i + 1] / 255;
      const b = data[i + 2] / 255;
      const a = data[i + 3] / 255;
      data[i] = (m[0] * r + m[1] * g + m[2] * b + m[3] * a + m[4]) * 255;
      data[i + 1] = (m[5] * r + m[6] * g + m[7] * b + m[8] * a + m[9]) * 255;
      data[i + 2] = (m[10] * r + m[11] * g + m[12] * b + m[13] * a + m[14]) * 255;
      data[i + 3] = (m[15] * r + m[16] * g + m[17] * b + m[18] * a + m[19]) * 255;
    }
  }
}
