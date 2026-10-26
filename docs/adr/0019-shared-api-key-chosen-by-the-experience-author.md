# 0019 — Shared API key, chosen by the experience author

- Date: 2026-10-26
- Status: Accepted (amends [ADR-0003](0003-per-user-api-key-authentication.md))

## Context

[ADR-0003](0003-per-user-api-key-authentication.md) made every person who
opens an experience paste their own Jakarto API key, and ruled out a shared
service key "by default". An organization running the widget on its ArcGIS
Enterprise portal asked whether a key could be hardcoded instead
(jakarto3d/experience-builder-jakarto-plugin#5). Its users already have
Jakarto accounts: the problem is the extra step, which can hold back
adoption. [ADR-0004](0004-cache-api-key-in-localstorage.md) softens it but
doesn't remove it — the key is remembered per browser and per site, so every
user still enters it at least once, and again on any other site hosting an
experience with the widget.

A key hardcoded in the widget's code is not an option: the release zips are
public and the same for every portal. The only place a key can legitimately
live is the experience itself, put there by the person who configures it.

## Decision

The experience author chooses how people sign in, in a **Jakarto sign-in**
section of the settings panel (French and English, like the rest of the
panel — [ADR-0018](0018-built-in-english-translation.md)):

- **Personal keys** (`config.authMode: 'personal'`, the default): exactly
  ADR-0003 and ADR-0004, unchanged. A config saved before the option existed
  has no `authMode` and reads as this.
- **Shared key** (`config.authMode: 'shared'`, plus `config.sharedApiKey`):
  the author enters one API key and the widget signs everyone in with it on
  load. The panel recommends the key of a dedicated **service account**, not
  a person's.

In shared mode:

- There is no login form and no logout button, and a personal key cached in
  the visitor's browser is ignored: nobody can switch to their own key.
- The key is **never written to `localStorage`** — `authenticate()` takes a
  `remember: false` option for it. It already lives in the experience's
  configuration, and caching it would only leave a second copy in every
  visitor's browser. ADR-0004's cache applies to personal keys only.
- While signing in, the panel says so ("Connexion à Jakarto…" / "Connecting
  to Jakarto…"). If there is no key, or Jakarto doesn't accept it, visitors
  get a message that says the panorama can't be opened and to **contact
  whoever administers the experience** — they have no form to retry from, and
  no way to fix it themselves. One message covers "the key was rejected" and
  "Jakarto couldn't be reached", because `authenticate()` returns the same
  `false` for both; it says the *connection* failed rather than claiming the
  key was refused.
- Choosing the shared key shows, right under the field, a warning with the
  trade-offs the author is accepting, including what it means for an
  experience shared publicly: the key is readable by anyone who can open the
  experience; it gives access to everything the account's licence allows, not
  only this widget, and can't be limited to the portal's domain; everyone gets
  the same access and usage adds up to one total, so misuse is hard to spot;
  in a public experience, anyone on the Internet can take the key and use it.

How the two modes compare, as the author sees it:

| | Personal keys | Shared key |
| --- | --- | --- |
| For visitors | Each enters their own key | Nothing to enter, the panorama opens directly |
| Access to data | Each user's own permissions | The service account's, for everyone |
| Usage reports | Per user | One total |
| Confidentiality | The key stays with its owner | Readable by anyone who can open the experience |
| If the key leaks | One account at risk, unusual usage stands out | Everything the licence allows; misuse blends into the shared usage |

Smaller choices:

- The key field saves when it loses focus or Enter is pressed
  (`onAcceptValue`), not on every keystroke: each change re-signs the widget
  in, and half-typed keys would be sent to Jakarto one after the other. The
  value is trimmed, here and again when read, because a copy-paste usually
  brings a trailing newline.
- The field is a password field (not shown on screen) with
  `autoComplete="new-password"`, so a browser doesn't offer the author's own
  saved password for it. The masking is for over-the-shoulder reading only:
  the key is still in the downloaded configuration.
- **Switching back to personal keys erases the key** from the configuration.
  Otherwise it would stay in what every browser downloads, unused and
  forgotten. The cost is retyping it if the author switches again.
- The choice is read through `src/lib/authMode.ts` (pure, unit-tested per
  [ADR-0011](0011-extract-pure-logic-for-unit-testing.md)), which ignores a
  key unless the mode is `'shared'`, so a stale key can never sign anyone in.
- Changing the mode or the key in the builder re-signs the preview in, and
  drops what the previous session was showing first.

Not done:

- **Keeping the key out of the browser.** That would need a server-side
  component that holds it and hands browsers a session. This widget is purely
  client-side; what is offered here is the cheaper option, with its limits
  spelled out to the author.
- A "Retry" button on the failure message. Nobody asked, and the failure is
  one the author has to fix anyway.

## Consequences

- An organization can open the panorama to its users with no sign-in step, at
  the price of the confidentiality row above. That price is the author's to
  weigh, which is why it is a per-experience choice with a warning rather than
  a default, and why the public release stays keyless.
- Anyone who can open a shared-key experience can read the key from its
  configuration. Rotating it means changing it in the settings panel and
  re-publishing the experience.
- Signing in exchanges the key for a session cookie on `account.jakarto.com`
  ([`jakartowns-integration.md`](../specs/jakartowns-integration.md)). A
  visitor's browser therefore holds the **service account's** session while a
  shared-key experience is open, which is expected to replace any Jakarto
  session of their own in that browser — and "Open in Jakartowns" would open
  `maps.jakarto.com` as the service account. Inferred from the flow, not
  checked against a live portal: see
  [`known-issues.md`](../known-issues.md).
- The failure message cannot tell a revoked key from a network problem.
- The widget README is updated. The public documentation on docs.jakarto.com
  still says signing in is individual; it lives outside this repository and
  needs the same update.
