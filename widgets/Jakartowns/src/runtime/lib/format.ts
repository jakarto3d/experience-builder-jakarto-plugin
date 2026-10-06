import { resolveLanguage, type Language } from '../../lib/locale'

const DATE_LOCALES: Record<Language, string> = { fr: 'fr-CA', en: 'en-CA' }

/**
 * Formats a Jakarto image date for display, in the language the panel's
 * strings use (see lib/locale.ts): "13 juill. 2026" in French, "Jul 13, 2026"
 * in English. `locale` is the app locale Experience Builder reports.
 */
export function formatJakartoDate(dateString: string | null, locale?: string | null): string | null {
  if (!dateString) return null
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return null
  const dateLocale = DATE_LOCALES[resolveLanguage(locale)]
  return new Intl.DateTimeFormat(dateLocale, { year: 'numeric', month: 'short', day: 'numeric' }).format(date)
}
