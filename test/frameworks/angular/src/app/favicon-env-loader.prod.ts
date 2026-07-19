import type { EnvFaviconOptions } from 'favicon-env';

type EnvFavicon = (options?: EnvFaviconOptions) => Promise<void>;

export async function loadEnvFavicon(): Promise<EnvFavicon | null> {
  return null;
}
