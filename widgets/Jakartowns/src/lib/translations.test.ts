import runtimeFr from '../runtime/translations/default'
import runtimeEn from '../runtime/translations/en'
import settingFr from '../setting/translations/default'
import settingEn from '../setting/translations/en'

// The `typeof` annotation in each en.ts already stops a key from going
// missing at typecheck time; these checks cover what types can't: an empty
// string, a string left in French, and a `{version}` placeholder that got
// dropped or renamed in translation.
const bundles = {
  runtime: { fr: runtimeFr as Record<string, string>, en: runtimeEn as Record<string, string> },
  setting: { fr: settingFr as Record<string, string>, en: settingEn as Record<string, string> }
}

describe.each(Object.entries(bundles))('%s translations', (_name, { fr, en }) => {
  it('has the same keys in English and French', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(fr).sort())
  })

  it('has no empty English string', () => {
    for (const [key, value] of Object.entries(en)) {
      expect({ key, empty: value.trim() === '' }).toEqual({ key, empty: false })
    }
  })

  it('has no French accented character left in an English string', () => {
    // Typographic quotes and … are fine; accented letters are not.
    for (const [key, value] of Object.entries(en)) {
      expect({ key, accented: /[À-ÿ]/.test(value) }).toEqual({ key, accented: false })
    }
  })

  it('keeps the same {placeholders} in both languages', () => {
    const placeholders = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort()
    for (const key of Object.keys(fr)) {
      expect({ key, placeholders: placeholders(en[key]) }).toEqual({ key, placeholders: placeholders(fr[key]) })
    }
  })
})
