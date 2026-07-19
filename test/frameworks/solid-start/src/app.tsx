import { Link, MetaProvider, Title } from '@solidjs/meta';
import { Router } from '@solidjs/router';
import { FileRoutes } from '@solidjs/start/router';
import { onCleanup, onMount, Suspense } from 'solid-js';

const appEnv = import.meta.env.VITE_APP_ENV ?? 'prod';

export default function App() {
  onMount(() => {
    if (appEnv !== 'dev' && appEnv !== 'staging') return;

    let queued = false;
    const apply = async () => {
      queued = false;
      const { envFavicon } = await import('favicon-env');
      await envFavicon({
        environments: {
          dev: { badge: { text: 'D', color: '#8b5cf6', shape: 'cover', opacity: 0.55 } },
          staging: { hue: 210, invert: 0.8 },
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
    onCleanup(() => observer.disconnect());
  });

  return (
    <Router
      root={(props) => (
        <MetaProvider>
          <Title>favicon-env SolidStart integration</Title>
          <Link rel="icon" type="image/svg+xml" href="/favicon.svg" />
          <Suspense>{props.children}</Suspense>
        </MetaProvider>
      )}
    >
      <FileRoutes />
    </Router>
  );
}
