# 0017 — Signal a new release inside the settings panel

- Date: 2026-09-14
- Status: Accepted

## Context

The widget ships as a zip attached to a GitHub release
([ADR-0015](0015-automate-portal-ready-release-build.md)), which someone
uploads by hand as a custom widget resource on an ArcGIS Enterprise portal.
Nothing in that flow ever looks back at the source:

- Once registered, the widget stays at the version that was uploaded. The
  portal has no notion of an upstream, no update channel, and no way to tell
  that `v1.1.0` was published last week.
- The people who would act on that information — whoever administers the
  portal or maintains the experience — don't necessarily watch the GitHub
  repository, and asking them to subscribe to release notifications puts the
  burden on a habit rather than on the product.
- The widget already knows its own version: Experience Builder injects
  `manifest.json` into the widget's props (`props.manifest.version`), both
  at runtime and in the settings panel.

The missing piece is therefore only the *published* version, and a place to
say it where the right person will see it.

## Decision

- The settings panel gained a **"Version du widget"** section
  (`src/setting/components/UpdateNotice.tsx`) showing the installed version
  and one of four states: checking, up to date, update available, or
  "couldn't check".
- The published version comes from GitHub's public
  `/repos/jakarto3d/experience-builder-jakarto-plugin/releases/latest`
  endpoint — unauthenticated, CORS-enabled, no infrastructure of ours to
  keep alive next to the widget. The tag (`v1.2.0`) is compared field by
  field against the manifest version; a strictly greater `MAJOR.MINOR.PATCH`
  is what triggers the notice.
- The check is **builder-side only**. The published experience makes no such
  request: its visitors can't update anything, so a banner there would be
  noise on a public map, plus an outbound call on every page view.
- Failure is always silent (`src/setting/lib/updateCheck.ts` resolves to
  `null`, never throws, and logs nothing): a portal without outbound
  Internet access, behind a proxy, or hitting GitHub's 60 requests/hour
  per-IP limit falls back to the "couldn't check" line instead of showing an
  error in the settings panel.
- Successful answers are cached in `localStorage` for 24 h, well below this
  widget's release cadence, so repeatedly opening the settings panel in one
  builder session costs a single request for everyone sharing the portal's
  outbound IP.
- The comparison, parsing and caching logic is pure and unit-tested
  (`updateCheck.test.ts`), per
  [ADR-0011](0011-extract-pure-logic-for-unit-testing.md); the React
  component only renders the resulting state.

## Consequences

- Opening the widget's settings in the builder is now enough to learn that a
  new version exists, and the notice links straight to the release page with
  the name of the zip to download (`Jakartowns-v<version>-portal.zip`).
- The builder makes a request to `api.github.com` when the settings panel is
  opened. It is anonymous (`credentials: 'omit'`), sends no information
  about the portal or the experience beyond what any HTTP request carries,
  and can be blocked by the portal's network policy without breaking
  anything — the panel just shows "mise à jour non vérifiable".
- Detection depends on the repository staying public and on tags keeping the
  `v<MAJOR>.<MINOR>.<PATCH>` shape that `.bumpversion.toml` produces. A
  private repository, a renamed repository, or a tag in another format all
  degrade to the same silent "couldn't check" state — never to a wrong
  claim that an update exists.
- The notice reports what is *published*, not what is *compatible*: it does
  not look at the portal's Experience Builder version against the release's
  `exbVersion`. Whoever updates still has to check that, as they already do
  when installing.
- Nothing updates itself. The zip is still uploaded by hand — this ADR is
  about knowing, not about automating the install, which Experience Builder
  offers no API for.
