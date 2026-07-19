import { StartClient } from '@tanstack/react-start/client';
import { StrictMode } from 'react';
import { hydrateRoot } from 'react-dom/client';

const appEnv = import.meta.env.VITE_APP_ENV ?? 'prod';

if (appEnv === 'dev' || appEnv === 'staging') {
  let queued = false;
  const applyFavicon = async () => {
    queued = false;
    const { envFavicon } = await import('favicon-env');
    await envFavicon({
      environments: {
        dev: { tint: '#22c55e' },
        staging: { filter: 'grayscale(1) sepia(1) saturate(4) hue-rotate(315deg)' },
      },
      detect: () => appEnv,
    });
  };
  const scheduleFavicon = () => {
    if (queued) return;
    queued = true;
    queueMicrotask(applyFavicon);
  };
  const faviconObserver = new MutationObserver(() => {
    if (document.head.querySelector('link[rel~="icon"]:not([data-favicon-env])')) {
      scheduleFavicon();
    }
  });

  faviconObserver.observe(document.head, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['href', 'rel'],
  });
  scheduleFavicon();
}

hydrateRoot(
  document,
  <StrictMode>
    <StartClient />
  </StrictMode>,
);
