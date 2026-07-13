import { formatJakartoDate } from './format'

describe('formatJakartoDate', () => {
  it('formats a valid ISO date in fr-CA (day month(abbrev) year)', () => {
    expect(formatJakartoDate('2026-07-13')).toBe('13 juill. 2026')
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
