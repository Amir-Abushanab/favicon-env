---
"favicon-env": minor
---

Add `tint` — colourise the favicon to an exact colour per environment. `tint: '#hex'` recolours the icon to that exact colour while preserving its shape and shading (a luminance duotone), so a white logo becomes solid `tint`. It complements `hue` (a *relative* rotation); precedence is `filter` > `tint` > `hue`. Works in both runtime (canvas) and build-time SSR modes.
