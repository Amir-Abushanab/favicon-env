import { Component, DestroyRef, afterNextRender, inject } from '@angular/core';
import { loadEnvFavicon } from './favicon-env-loader';

@Component({
  selector: 'app-root',
  imports: [],
  template: `<main [attr.data-app-env]="appEnv">Angular SSR fixture</main>`,
})
export class App {
  protected readonly appEnv = APP_ENV;
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    afterNextRender(() => {
      if (this.appEnv !== 'dev' && this.appEnv !== 'staging') return;

      let queued = false;
      const apply = async () => {
        queued = false;
        const envFavicon = await loadEnvFavicon();
        if (!envFavicon) return;
        await envFavicon({
          environments: {
            dev: { src: '/favicon.svg?custom=angular-dev' },
            staging: { src: '/favicon.svg?custom=angular-staging', tint: '#06b6d4' },
          },
          detect: () => this.appEnv,
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
      this.destroyRef.onDestroy(() => observer.disconnect());
    });
  }
}
