import { formatJakartoDate } from './format'

describe('formatJakartoDate', () => {
  it('formats a valid ISO date in fr-CA (day month(abbrev) year)', () => {
    expect(formatJakartoDate('2026-07-13')).toBe('13 juill. 2026')
  })

  it('formats in French for a French locale', () => {
    expect(formatJakartoDate('2026-07-13', 'fr-ca')).toBe('13 juill. 2026')
  })

  it('formats in English (month(abbrev) day, year) for an English locale', () => {
    // Older ICU versions put a period after the abbreviated month.
    expect(formatJakartoDate('2026-07-13', 'en')).toMatch(/^Jul\.? 13, 2026$/)
    expect(formatJakartoDate('2026-07-13', 'en-ca')).toMatch(/^Jul\.? 13, 2026$/)
  })

  it('falls back to French for a locale the widget has no translation for', () => {
    expect(formatJakartoDate('2026-07-13', 'de')).toBe('13 juill. 2026')
  })

  it('returns null for a null input', () => {
    expect(formatJakartoDate(null)).toBeNull()
  })

  it('returns null for an empty string', () => {
    expect(formatJakartoDate('')).toBeNull()
  })

  it('returns null for an unparseable date string', () => {
    expect(formatJakartoDate('not-a-date')).toBeNull()
  })
})
