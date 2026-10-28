import { defineEnvVars } from '@sveltejs/kit/env';

// SvelteKit 3 replaces the PUBLIC_ prefix convention with declared variables.
// `static` inlines the build-time value, as `$env/static/public` did.
export const variables = defineEnvVars({
  PUBLIC_APP_ENV: {
    public: true,
    static: true,
    schema: (value) => value || 'prod',
  },
});
