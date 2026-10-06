import { type ImmutableObject } from 'jimu-core'
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
}

export type IMConfig = ImmutableObject<Config>
