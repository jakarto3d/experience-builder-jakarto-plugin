/**
 * Picks which set of UI strings to show — see
 * docs/adr/0018-built-in-english-translation.md.
 *
 * Both languages are bundled into the widget and chosen from the locale
 * Experience Builder injects as `props.locale` (the builder's/viewer's
 * language: "en", "en-ca", "fr-ca", …), rather than left to the framework's
 * per-locale `translations/<locale>.js` loading, so the choice is a plain
 * function that can be unit-tested.
 */

export type Language = 'fr' | 'en'

/** English for any English locale; French — the widget's original language — for everything else. */
export function resolveLanguage(locale: string | null | undefined): Language {
  const primaryLanguage = locale?.toLowerCase().split(/[-_]/)[0]
  return primaryLanguage === 'en' ? 'en' : 'fr'
}

export function pickMessages<T>(locale: string | null | undefined, messages: Record<Language, T>): T {
  return messages[resolveLanguage(locale)]
}
