# favicon-env

## 0.3.0

### Minor Changes

- 7bad0f7: Add `invert` — flip the favicon's colours per environment for an instant, high-contrast variant with no colour to pick. `invert: true` inverts fully; a `0`–`1` number is a partial invert (maps to CSS `invert()`). It composes with `hue` (both apply), while `tint` and an explicit `filter` take precedence. Works in both runtime (canvas) and build-time SSR modes.

## 0.2.0

### Minor Changes

- 2f8e61a: Add `tint` — colourise the favicon to an exact colour per environment. `tint: '#hex'` recolours the icon to that exact colour while preserving its shape and shading (a luminance duotone), so a white logo becomes solid `tint`. It complements `hue` (a _relative_ rotation); precedence is `filter` > `tint` > `hue`. Works in both runtime (canvas) and build-time SSR modes.

### Patch Changes

- 76a88b3: Badge auto-contrast now understands CSS Color 4 colours. A `badge.color` in `oklch()` / `oklab()` / `lab()` / `lch()` now picks black or white text from its `L` (lightness) channel, instead of always falling back to white. Those colour spaces already passed through to the rendered favicon (`tint`, `badge.color`, `textColor` accept any CSS colour); this fixes the text-contrast heuristic for them.
