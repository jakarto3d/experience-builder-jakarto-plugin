import { isLanguage, resolveLanguage, toLanguageChoice } from './locale'

describe('resolveLanguage — from the locale alone', () => {
  it.each(['en', 'en-ca', 'en-US', 'EN-gb', 'en_CA'])('resolves %s to English', (locale) => {
    expect(resolveLanguage(locale)).toBe('en')
  })

  it.each(['fr', 'fr-ca', 'fr-FR'])('resolves %s to French', (locale) => {
    expect(resolveLanguage(locale)).toBe('fr')
  })

  it.each(['de', 'es', 'zh-cn', 'pt-br'])('falls back to French for the untranslated locale %s', (locale) => {
    expect(resolveLanguage(locale)).toBe('fr')
  })

  it.each([undefined, null, ''])('falls back to French when the locale is %p', (locale) => {
    expect(resolveLanguage(locale)).toBe('fr')
  })

  it('does not mistake a locale that merely starts with "en" for English', () => {
    expect(resolveLanguage('enm')).toBe('fr')
  })
})

describe('resolveLanguage — with preferences', () => {
  it("uses the admin's default over the locale", () => {
    expect(resolveLanguage('fr-ca', { adminDefault: 'en' })).toBe('en')
    expect(resolveLanguage('en-ca', { adminDefault: 'fr' })).toBe('fr')
  })

  it("follows the locale when the admin's default is 'auto'", () => {
    expect(resolveLanguage('en-ca', { adminDefault: 'auto' })).toBe('en')
    expect(resolveLanguage('fr', { adminDefault: 'auto' })).toBe('fr')
  })

  it("uses the end-user's choice over the admin's default and the locale", () => {
    expect(resolveLanguage('fr-ca', { adminDefault: 'fr', userChoice: 'en' })).toBe('en')
    expect(resolveLanguage('en-ca', { adminDefault: 'en', userChoice: 'fr' })).toBe('fr')
  })

  it("falls back to the admin's default when the end-user has made no choice", () => {
    expect(resolveLanguage('en', { adminDefault: 'fr', userChoice: null })).toBe('fr')
    expect(resolveLanguage('en', { adminDefault: 'fr', userChoice: undefined })).toBe('fr')
  })

  it.each([['de'], [''], [42], [{}], [['en']]])('ignores %p as a user choice', (junk) => {
    expect(resolveLanguage('en', { adminDefault: 'fr', userChoice: junk })).toBe('fr')
    expect(resolveLanguage('fr', { userChoice: junk })).toBe('fr')
  })

  it.each([['de'], [''], [42], [{}], [undefined]])('ignores %p as an admin default', (junk) => {
    expect(resolveLanguage('en-ca', { adminDefault: junk })).toBe('en')
  })
})

describe('isLanguage', () => {
  it('accepts exactly the shipped languages', () => {
    expect(isLanguage('fr')).toBe(true)
    expect(isLanguage('en')).toBe(true)
    expect(isLanguage('auto')).toBe(false)
    expect(isLanguage('FR')).toBe(false)
    expect(isLanguage(null)).toBe(false)
  })
})

describe('toLanguageChoice', () => {
  it('keeps a shipped language', () => {
    expect(toLanguageChoice('fr')).toBe('fr')
    expect(toLanguageChoice('en')).toBe('en')
  })

  it.each([['auto'], ['de'], [''], [undefined], [null], [7]])("maps %p to 'auto'", (value) => {
    expect(toLanguageChoice(value)).toBe('auto')
  })
})
