import { envFavicon } from './tint';
import type { EnvFaviconOptions, EnvTint } from './types';

// IIFE entry for no-build sites. Exposed as `window.faviconEnv.envFavicon(...)`,
// and auto-runs from the loading <script>'s data-* attributes:
//   <script src="…/favicon-env.global.js" data-auto></script>
//   <script src="…/favicon-env.global.js" data-dev="130" data-staging="45"></script>
function boot(): void {
  const el = document.currentScript as HTMLScriptElement | null;
  if (!el) return;
  const data = el.dataset;
  if (data.auto !== undefined) {
    void envFavicon({ auto: true });
    return;
  }
  const environments: Record<string, EnvTint> = {};
  for (const [name, value] of Object.entries(data)) {
    const hue = Number(value);
    if (value !== undefined && value !== '' && !Number.isNaN(hue)) {
      environments[name] = { hue };
    }
  }
  if (Object.keys(environments).length > 0) void envFavicon({ environments });
}

boot();

export { envFavicon };
export type { EnvFaviconOptions };
