---
"favicon-env": patch
---

Badge auto-contrast now understands CSS Color 4 colours. A `badge.color` in `oklch()` / `oklab()` / `lab()` / `lch()` now picks black or white text from its `L` (lightness) channel, instead of always falling back to white. Those colour spaces already passed through to the rendered favicon (`tint`, `badge.color`, `textColor` accept any CSS colour); this fixes the text-contrast heuristic for them.
