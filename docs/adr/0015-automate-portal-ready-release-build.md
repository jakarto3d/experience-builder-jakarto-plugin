# 0015 — Automate a portal-ready build in the release workflow

- Date: 2026-07-29
- Status: Accepted

## Context

`.github/workflows/release.yml` packaged tagged releases as
`zip -r Jakartowns-<tag>.zip widgets/Jakartowns` — the widget's **source**
only, no `dist/`. Per [ADR-0001](0001-scaffold-without-local-dev-edition.md)
that's the only thing this repo can produce on its own, and it's sufficient
for copying into a Developer Edition and running `npm start` (see
[`../../widgets/Jakartowns/README.md`](../../widgets/Jakartowns/README.md)).

It is **not** sufficient for registering the widget as a custom widget
resource in a real ArcGIS Enterprise portal: that requires the built
`dist/runtime/widget.js` / `dist/setting/setting.js`. Loading the
source-only zip there produces console errors (404s on those files, then a
`__set_webpack_public_path__` TypeError) — the widget registers but is
broken.

This was hit and worked around manually for the widget's first deployment
into a real municipality's ArcGIS Enterprise portal: download ArcGIS
Experience Builder Developer Edition 1.14, `npm install` in its `client/`
folder, copy this repo's `widgets/Jakartowns` into
`client/your-extensions/widgets/`, force Node to `v20.20.2` (same
`tinyglobby` issue the README already documents for `npm start`), run
`npm run build:prod`, and zip the resulting `client/dist-prod/widgets/Jakartowns/`.

Automating that in CI has one wrinkle: there is no stable, static download
URL for the SDK zip. The Download button on
`developers.arcgis.com/experience-builder/guide/downloads/` is a JS
component that mints a per-click, time-limited Akamai-signed URL (a
`__gdb__` query token); requesting the zip without one gets a 403 from
Akamai. No Esri/ArcGIS account is involved (the resulting URL carries
`agolUsername=NA`), so this isn't a login wall — but it does mean the URL
can't be hardcoded or guessed.

## Decision

- Added `scripts/fetch-exb-sdk.mjs`, a small Playwright script that opens the
  real downloads page, dismisses the cookie-consent banner (Reject All),
  clicks the Download button for a given `<major>.<minor>` version, and
  streams the resulting response to disk. This mirrors normal use of Esri's
  own page rather than reverse-engineering the token format, so it keeps
  working even if Esri changes how the token is generated — only the
  page's `data-testid="download-button-arcgis-experience-builder-X-Y-zip"`
  selector needs to keep existing.
- `release.yml`'s `release` job now: packages the existing source-only zip
  (unchanged, still useful for local Dev Edition installs), then downloads
  the SDK via that script, `npm install`s it, copies the widget into
  `your-extensions/widgets/`, runs `npm run build:prod` under Node
  `20.20.2`, and packages `dist-prod/widgets/Jakartowns/` as a second
  `Jakartowns-<tag>-portal.zip` release asset — the one to hand to an
  integrator/portal admin.
- The SDK version to build against is derived from
  `widgets/Jakartowns/manifest.json`'s `exbVersion` (truncated to
  major.minor) instead of being duplicated in the workflow. That field was
  also corrected from `1.16.0` to `1.14.0` — 1.14 is the only version this
  widget has actually been built and deployed against; `1.16.0` was never
  verified.
- Verified locally end-to-end before merging (SDK 1.14 fetched via the
  script, `npm install` + `npm run build:prod` against this repo's
  `widgets/Jakartowns`, output matched the manually-produced artifact
  structure: `dist/`, `config.json`, `icon.svg`, `manifest.json`, no
  `src/`).

## Consequences

- The release job is meaningfully slower (Chromium install, a full second
  `npm install` for the SDK's `client/`, a webpack build) and now depends on
  `developers.arcgis.com`'s downloads page keeping its current markup. If
  Esri changes it, `fetch-exb-sdk.mjs` fails loudly (`Could not resolve a
  download URL...`) rather than silently shipping a broken artifact — same
  failure mode as before this change, just with a clearer error.
- Bumping the widget to a newer Experience Builder version now means
  updating `manifest.json`'s `exbVersion` and re-verifying the build (and,
  ideally, re-verifying deployment against a real portal) — the workflow
  will build against whatever version is declared there, tested or not.
- Releases now ship two zips instead of one; anyone deploying to production
  should grab the `-portal.zip`, not the plain one.
