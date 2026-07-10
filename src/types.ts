/** A tint / decoration to apply to the favicon for a given environment. */
export interface EnvTint {
  /** Hue rotation in degrees applied to the whole icon (e.g. `120`). */
  hue?: number;
  /**
   * Explicit CSS filter string, e.g. `'hue-rotate(120deg) saturate(1.4)'`.
   * Takes precedence over `hue` when both are set.
   */
  filter?: string;
  /**
   * Use this image URL (or data URI) as the base for this environment, instead
   * of the page's current favicon — e.g. a different logo for staging. Any
   * `hue` / `filter` / `badge` is composited on top of it.
   */
  src?: string;
  /**
   * A corner badge. A `string` is shorthand for a dot of that colour; an object
   * (`Badge`) can also carry `text`, such as a PR number, rendered as a pill.
   */
  badge?: string | Badge;
}

/** A badge drawn on top of the icon. */
export interface Badge {
  /** Text to render, e.g. a PR number (`344`, `'#344'`). Omit for a plain dot. */
  text?: string | number;
  /** Background colour. Default `'#ef4444'`. */
  color?: string;
  /** Text colour. Default: auto — black or white, whichever contrasts with `color`. */
  textColor?: string;
  /**
   * `'pill'` (default) draws a rounded badge on top of your icon, placed by
   * `corner` / `size`. `'cover'` replaces the whole icon with the colour + a big
   * centred number — nothing of the base shows through, so it reads at 16px.
   */
  shape?: 'pill' | 'cover';
  /** Where a pill sits. Default `'bottom-right'`; `'center'` overlays the icon. */
  corner?: BadgeCorner;
  /** Pill height as a fraction of the icon (0–1). Default `0.5`. (Ignored by `'cover'`.) */
  size?: number;
  /** Badge opacity, 0–1 (default `1`). With `shape: 'cover'`, below `1` lets the icon show through. */
  opacity?: number;
}

export type BadgeCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';

/** Per-environment config. `false` / `null` / omitted leaves the favicon untouched. */
export type EnvConfig = EnvTint | false | null | undefined;

/** Computes badge text from a regex match (if any) and the current URL. */
export type BadgeTextFn = (match: RegExpMatchArray | null, url: URL) => string | number;

/**
 * A `Badge` for use in a `rule`, whose `text` may additionally be a function, or
 * a template with `$1` / `$<name>` placeholders filled from the rule's regex
 * captures — e.g. `'#$1'` against `/^pr-(\d+)\./`.
 */
export type RuleBadge = Omit<Badge, 'text'> & { text?: string | number | BadgeTextFn };

/**
 * A URL-matching rule. When `match` matches, this rule's tint is applied (and no
 * later rule is tried). Rules are checked in order, before `auto` and
 * `environments`/`detect`.
 */
export type EnvRule = Omit<EnvTint, 'badge'> & {
  /**
   * A `RegExp` (tested against `location.host`, i.e. `hostname:port`) or a
   * function receiving the full `URL`. Regex captures feed `badge.text`.
   */
  match: RegExp | ((url: URL) => boolean);
  /** Badge whose `text` may be a `$1` / `$<name>` template or a function of the match. */
  badge?: string | RuleBadge;
};

/** Options for `envFavicon`. */
export interface EnvFaviconOptions {
  /** Map of environment name → tint. A missing entry (or `false`) means "leave as-is". */
  environments?: Record<string, EnvConfig>;
  /**
   * URL-matching rules, checked in order before `auto` / `environments`. The
   * first rule whose `match` matches wins, and its regex captures can be
   * interpolated into `badge.text` (e.g. a PR number). Great for preview deploys.
   */
  rules?: EnvRule[];
  /**
   * Return the current environment name (a key of `environments`). Defaults to
   * `defaultDetect`, a `location.hostname` heuristic.
   */
  detect?: () => string | undefined;
  /**
   * Auto mode: ignore `environments` and derive a *stable, unique* hue from
   * `location.host`, so every origin/port gets its own colour with no config.
   * Pass an `AutoOptions` object to tune it.
   */
  auto?: boolean | AutoOptions;
  /** Favicon source URL. Defaults to the page's current icon, then `/favicon.ico`. */
  source?: string;
  /** Canvas raster size in px. Default `64`. */
  size?: number;
}

/** Tuning for `EnvFaviconOptions.auto`. */
export interface AutoOptions {
  /** Extra hue offset (deg) added to the derived hue — shifts the whole palette. */
  offset?: number;
}
