import type { Badge } from './types';

/** Normalise the `badge` shorthand (a `string` is a dot of that colour) to a `Badge`. */
export function normalizeBadge(badge: string | Badge): Badge {
  return typeof badge === 'string' ? { color: badge } : badge;
}
