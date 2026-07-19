export default defineNuxtPlugin(() => {
  const appEnv = __FAVICON_ENV_APP_ENV__;
  if (appEnv !== 'dev' && appEnv !== 'staging') return;

  let queued = false;
  const apply = async () => {
    queued = false;
    const { envFavicon } = await import('favicon-env');
    await envFavicon(
      appEnv === 'dev'
        ? {
            rules: [
              {
                match: /^127\.0\.0\.1:(\d+)$/,
                badge: { text: '$1', color: '#10b981', corner: 'bottom-left' },
              },
            ],
          }
        : {
            rules: [
              {
                match: (url) => url.hostname === '127.0.0.1',
                badge: { text: (_match, url) => `S${url.port.slice(-2)}`, color: '#f59e0b' },
              },
            ],
          },
    );
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
});
