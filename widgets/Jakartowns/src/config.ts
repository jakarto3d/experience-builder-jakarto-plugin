import { type ImmutableObject } from 'jimu-core'

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
}

export type IMConfig = ImmutableObject<Config>
