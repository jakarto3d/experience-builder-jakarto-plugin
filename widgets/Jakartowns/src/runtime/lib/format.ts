import { type Language } from '../../lib/locale'

const DATE_LOCALES: Record<Language, string> = { fr: 'fr-CA', en: 'en-CA' }

/**
 * Formats a Jakarto image date for display in the language the panel's
 * strings are in (see lib/locale.ts): "13 juill. 2026" in French,
 * "Jul 13, 2026" in English.
 */
export function formatJakartoDate(dateString: string | null, language: Language = 'fr'): string | null {
  if (!dateString) return null
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat(DATE_LOCALES[language], { year: 'numeric', month: 'short', day: 'numeric' }).format(date)
}
