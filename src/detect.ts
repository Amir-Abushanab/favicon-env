/**
 * Default environment heuristic, based on `location.hostname`:
 *
 * - `localhost`, `127.0.0.1`, `::1`, `*.local`, `*.localhost`, a raw IPv4 → `'dev'`
 * - a `staging` / `stg` / `qa` / `uat` / `preview` / `preprod` / `test` / `dev`
 *   segment anywhere in the host → `'staging'`
 * - anything else → `'prod'`
 *
 * It's intentionally simple. Pass your own `detect` to `envFavicon` when your
 * hostnames don't follow these conventions.
 *
 * @param hostname override the host to classify (defaults to `location.hostname`)
 */
export function defaultDetect(
  hostname: string = typeof location === 'undefined' ? '' : location.hostname,
): string {
  const h = hostname.toLowerCase();
  if (
    h === 'localhost' ||
    h === '127.0.0.1' ||
    h === '::1' ||
    h === '[::1]' ||
    h.endsWith('.local') ||
    h.endsWith('.localhost') ||
    /^\d{1,3}(?:\.\d{1,3}){3}$/.test(h)
  ) {
    return 'dev';
  }
  if (/(?:^|[.-])(?:staging|stg|qa|uat|preview|preprod|test|dev)(?:[.-]|$)/.test(h)) {
    return 'staging';
  }
  return 'prod';
}
