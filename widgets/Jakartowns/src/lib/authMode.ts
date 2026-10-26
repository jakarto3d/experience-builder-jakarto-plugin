/**
 * How the widget signs in to Jakarto — see
 * docs/adr/0019-shared-api-key-chosen-by-the-experience-author.md.
 *
 * Pure so it can be unit-tested (ADR-0011): the settings panel and the
 * runtime both read the same two config fields through here, so neither has to
 * decide on its own what a missing or malformed value means.
 */

/** What the experience author picks in the settings panel. */
export type AuthMode = 'personal' | 'shared'

/** Normalizes a stored/selected value: anything unknown — including an absent field — means `'personal'`, the widget's original behavior. */
export function toAuthMode(value: unknown): AuthMode {
  return value === 'shared' ? 'shared' : 'personal'
}

/** What the runtime has to do to sign in. */
export type AuthSetup =
  | { mode: 'personal' }
  /** `apiKey` is `''` when the author chose a shared key but hasn't entered one yet. */
  | { mode: 'shared', apiKey: string }

export interface AuthConfig {
  authMode?: unknown
  sharedApiKey?: unknown
}

/**
 * Reads the sign-in setup from the widget's config. Config saved before the
 * option existed has neither field, and the key is only ever honored in
 * `'shared'` mode: a key left over in a config set back to personal keys must
 * not sign anyone in.
 */
export function resolveAuthSetup(config: AuthConfig | null | undefined): AuthSetup {
  if (toAuthMode(config?.authMode) === 'personal') return { mode: 'personal' }
  const apiKey = typeof config?.sharedApiKey === 'string' ? config.sharedApiKey.trim() : ''
  return { mode: 'shared', apiKey }
}
