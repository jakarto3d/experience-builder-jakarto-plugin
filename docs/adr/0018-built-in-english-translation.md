# 0018 — Built-in English translation, with admin and end-user language choice

- Date: 2026-10-06
- Status: Accepted

## Context

Until now the widget spoke French only. `translations/default.ts` held the
French strings, `manifest.json` declared `"translatedLocales": ["fr"]`, and
`widget.tsx`, `setting.tsx` and `UpdateNotice.tsx` imported that file
directly. Nothing ever looked at the locale Experience Builder runs in, so
there was nothing to add an English file *to*: dropping an `en.ts` next to
`default.ts` would not have changed what anyone saw.

A user at an English-speaking organization installed the widget and asked for
an out-of-the-box English version (jakarto3d/experience-builder-jakarto-plugin#3).
Their workaround — the browser's page translation — works for them but not for
the less technical staff the experience is built for.

Two ways of getting a second language into an Experience Builder widget:

- **The framework's own mechanism.** Experience Builder loads
  `translations/<locale>.js` at runtime for a locale listed in
  `translatedLocales` and hands the strings to the widget through
  `props.intl`. In the Developer Edition build the `translations/` folder is
  copied as-is, so the non-default files have to be authored in the format
  the runtime's module loader expects (the stock widgets ship compiled
  `System.register` modules). That could not be exercised here: it needs a
  running Experience Builder against a portal, and a locale file the loader
  can't read is a failure we'd only meet on a customer's portal.
- **Bundling both languages and choosing in code.** Both sets of strings are
  ordinary TypeScript modules compiled into `widget.js` / `setting.js`; the
  choice is a function of `props.locale`, which the framework injects into
  both the runtime and the settings components.

## Decision

- English lives in `src/runtime/translations/en.ts` and
  `src/setting/translations/en.ts`, each typed `typeof defaultMessages`, so a
  key missing from (or misspelled in) the English file is a compile error.
  `default.ts` stays French and stays the source of the key list.
- `src/lib/locale.ts` holds the selection, pure and unit-tested per
  [ADR-0011](0011-extract-pure-logic-for-unit-testing.md). The language shown
  is, in order of precedence:
  1. **the end-user's own pick**, from a "Language" selector in the gear
     popover of the panel (*Default* / *Français* / *English*), remembered in
     that browser's `localStorage` next to the right-click option
     (`jakartowns-viewer:settings`). *Default* clears the pick, so a user who
     chose by accident can get back to whatever the admin set up;
  2. **the admin's default**, a "Default language" option in the settings
     panel (*Automatic* / *Français* / *English*, `config.language`, default
     `'auto'`), set per experience;
  3. **the locale Experience Builder reports** (`props.locale`): any English
     locale (`en`, `en-ca`, `en_US`…) gets English; **everything else keeps
     French**, the widget's existing behavior.

  Both preferences come from storage/config that may be in any shape —
  `config.language` is absent on widgets saved before the option existed —
  so anything that isn't a shipped language is ignored rather than trusted.
- The settings panel itself follows the builder's locale only: "Default
  language" is about what visitors see, and an admin working in a French
  builder shouldn't have the panel flip to English because they picked
  English for their audience.
- No option for an admin to *lock* the language and hide the end-user
  selector. Nobody asked for it; it would be a second option and a second
  precedence rule, and can be added later without changing anything above.
- `formatJakartoDate` takes the resolved language and formats `en-CA`
  ("Jul 13, 2026") or `fr-CA` ("13 juill. 2026") to match the labels around
  it — a French date in an English panel would have been the one string
  nobody translated.
- `translatedLocales` stays `["fr"]`. Listing `"en"` would make the
  framework try to load an `en.js` that doesn't exist; the English strings
  don't depend on that mechanism.
- `translations.test.ts` checks what the types can't: same keys in both
  languages, no empty English string, no French accented letter left in an
  English string, and the same `{version}` placeholders in both.

## Consequences

- A builder or viewer whose Experience Builder language is English sees the
  panel, the login form, the date timeline and the settings panel in English
  with no configuration; French users see exactly what they saw before.
  An admin can fix the language for an experience, and any visitor can
  switch it for themselves.
- The visitor's pick is per browser, not per account or per experience: it
  applies to every Jakartowns widget on that origin, the same way the
  right-click option already does.
- Falling back to French rather than English for languages we don't ship
  (German, Spanish…) is a choice, not a given: it keeps behavior unchanged for
  every non-English user. If Jakarto would rather those users get English,
  it's the one-line `? 'en' : 'fr'` in `languageOfLocale` (`lib/locale.ts`).
  Now that an admin can pick a language outright, an experience aimed at
  German or Spanish speakers can at least choose English instead of French.
- Adding a third language means a new `<lang>.ts` per translations folder,
  a `Language` member, a branch in `languageOfLocale`, and an `<option>` in
  both selectors — more plumbing than
  the framework's mechanism would need, which is what this ADR traded for
  something testable. If the framework's loading is later confirmed against a
  live portal, this could be revisited.
- The English files are copied into the built `dist/*/translations/` folders
  next to `default.ts` (the build copies the whole folder) but are never
  requested from there; the copy that is used is the one inside the bundle.
- Only the widget's own strings are covered. The embedded Jakartowns
  panorama viewer renders its own UI, and the French tutorial on
  docs.jakarto.com is separate — neither is changed by this.
- The `console.error`/`console.warn` messages in `services/jakarto.ts` are
  still French: they're for whoever opens the browser console, not shown to
  users.
