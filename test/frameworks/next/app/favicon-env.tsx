'use client';

import { useEffect } from 'react';

const appEnv = process.env.NEXT_PUBLIC_APP_ENV ?? 'prod';

export function FaviconEnv() {
  useEffect(() => {
    if (appEnv !== 'dev' && appEnv !== 'staging') return;

    let queued = false;
    const apply = async () => {
      queued = false;
      const { envFavicon } = await import('favicon-env');
      await envFavicon({
        environments: {
          dev: { hue: 135 },
          staging: { invert: true },
        },
        detect: () => appEnv,
      });
    };
    const schedule = () => {
      if (queued) return;
      queued = true;
      queueMicrotask(apply);
    };
    const observer = new MutationObserver(() => {
      if (document.head.querySelector('link[rel~="icon"]:not([data-favicon-env])')) {
        schedule();
      }
    });

    observer.observe(document.head, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['href', 'rel'],
    });
    schedule();

    return () => observer.disconnect();
  }, []);

  return null;
}
