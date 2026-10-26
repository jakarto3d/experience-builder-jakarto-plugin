import { type ImmutableObject } from 'jimu-core'
import { type AuthMode } from './lib/authMode'
import { type LanguageChoice } from './lib/locale'

/**
 * Options exposed in the widget's settings panel (see src/setting/setting.tsx).
 * `useMapWidgetIds` (the binding to a Map widget) is a standard Experience
 * Builder field, handled separately by the framework — it doesn't appear here.
 *
 * Default values live in ../config.json (not here): without that file,
 * Experience Builder marks the widget `hasConfig: false` and `props.config`
 * stays undefined, which crashes the settings panel on load.
 */
export interface Config {
  /** Fallback position as long as no click/extent has been received from the linked map. */
  fallbackLatitude: number
  fallbackLongitude: number
  /** Whether Jakartowns shows its own compass for orienting inside the panorama. */
  compassEnabled: boolean
  /**
   * The language the widget opens in: a fixed one, or `'auto'` to follow the
   * language Experience Builder runs in. An end-user can still override it
   * for themselves from the panel's settings popover. Absent on widgets saved
   * before this option existed — read it through `resolveLanguage`, which
   * treats that as `'auto'`.
   */
  language: LanguageChoice
  /**
   * How people sign in: each with their own Jakarto API key (`'personal'`,
   * the original behavior), or all through `sharedApiKey` (`'shared'`).
   * Absent on widgets saved before this option existed — read both fields
   * through `resolveAuthSetup`, which treats that as `'personal'`.
   */
  authMode: AuthMode
  /**
   * The key every visitor is signed in with in `'shared'` mode, `''`
   * otherwise. Saved in the experience's configuration, which the browser
   * downloads: anyone who can open the experience can read it — see
   * docs/adr/0019-shared-api-key-chosen-by-the-experience-author.md.
   */
  sharedApiKey: string
}

export type IMConfig = ImmutableObject<Config>
