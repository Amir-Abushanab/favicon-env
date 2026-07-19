<script lang="ts">
  import { onMount } from 'svelte'

  let { children } = $props()

  onMount(() => {
    const appEnv = __FAVICON_ENV_APP_ENV__
    if (appEnv !== 'dev' && appEnv !== 'staging') return

    let queued = false
    const apply = async () => {
      queued = false
      const { envFavicon } = await import('favicon-env')
      await envFavicon({
        environments: {
          dev: { badge: { text: 'D', color: '#ec4899', corner: 'top-left', size: 0.55 } },
          staging: { badge: { text: 'S', color: '#f59e0b', shape: 'cover' } },
        },
        detect: () => appEnv,
      })
    }
    const schedule = () => {
      if (queued) return
      queued = true
      queueMicrotask(apply)
    }
    const observer = new MutationObserver(() => {
      if (document.head.querySelector('link[rel~="icon"]:not([data-favicon-env])')) {
        schedule()
      }
    })

    observer.observe(document.head, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['href', 'rel'],
    })
    schedule()

    return () => observer.disconnect()
  })
</script>

<svelte:head>
  <title>favicon-env SvelteKit integration</title>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
</svelte:head>

{@render children()}
