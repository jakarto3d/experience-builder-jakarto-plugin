/**
 * Picks which set of UI strings to show — see
 * docs/adr/0018-built-in-english-translation.md.
 *
 * Both languages are bundled into the widget, so the choice is a plain
 * function that can be unit-tested rather than something left to the
 * framework's per-locale `translations/<locale>.js` loading.
 */

export type Language = 'fr' | 'en'

/** What an admin can pick in the settings panel: a fixed language, or follow Experience Builder's. */
export type LanguageChoice = 'auto' | Language

export function isLanguage(value: unknown): value is Language {
  return value === 'fr' || value === 'en'
}

/** Normalizes a stored/selected value to something the admin option can hold: anything unknown means `'auto'`. */
export function toLanguageChoice(value: unknown): LanguageChoice {
  return isLanguage(value) ? value : 'auto'
}

/** English for any English locale; French — the widget's original language — for everything else. */
function languageOfLocale(locale: string | null | undefined): Language {
  const primaryLanguage = locale?.toLowerCase().split(/[-_]/)[0]
  return primaryLanguage === 'en' ? 'en' : 'fr'
}

export interface LanguagePreferences {
  /** The admin's default from the settings panel (`config.language`) — `'auto'` or absent defers to the locale. */
  adminDefault?: unknown
  /** The end-user's own pick from the panel's settings popover — absent defers to the admin's default. */
  userChoice?: unknown
}

/**
 * The language to show: the end-user's own choice, else the admin's default,
 * else the locale Experience Builder reports in `props.locale` ("en", "en-ca",
 * "fr-ca", …). Both preferences come from storage/config that a user or an
 * older version of the widget may have left in any shape, so anything that
 * isn't a known language is ignored rather than trusted.
 */
export function resolveLanguage(locale: string | null | undefined, preferences: LanguagePreferences = {}): Language {
  if (isLanguage(preferences.userChoice)) return preferences.userChoice
  if (isLanguage(preferences.adminDefault)) return preferences.adminDefault
  return languageOfLocale(locale)
}
