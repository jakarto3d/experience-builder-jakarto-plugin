import { pickMessages, resolveLanguage } from './locale'

describe('resolveLanguage', () => {
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

describe('pickMessages', () => {
  const messages = { fr: { hello: 'Bonjour' }, en: { hello: 'Hello' } }

  it('returns the English messages for an English locale', () => {
    expect(pickMessages('en-ca', messages)).toBe(messages.en)
  })

  it('returns the French messages for a French locale', () => {
    expect(pickMessages('fr', messages)).toBe(messages.fr)
  })

  it('returns the French messages when there is no locale', () => {
    expect(pickMessages(undefined, messages)).toBe(messages.fr)
  })
})
