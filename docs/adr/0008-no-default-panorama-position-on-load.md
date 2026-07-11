# 0008 — No default panorama position on first load

- Date: 2026-07-10
- Status: Accepted (reverses the original always-pass-a-position approach)

## Context

The viewer was originally always initialized with a starting position (the
linked map's center, or `config.fallbackLatitude/Longitude` as a further
fallback). In practice, that position often fell outside Jakarto's actual
coverage (only eastern Canada), and Jakartowns appeared to silently "jump" to
the nearest available data point regardless of the real distance — observed
as far west as Ontario. This was confusing (no visible link between the
configured fallback and what was shown) and was also the likely cause of the
date/multipass timeline staying empty on first load, since the resulting
`position` event may arrive without `currentSphereInfo`.

## Decision

`initializeViewer()` no longer receives a default position. The viewer
mounts empty (no initial `setPosition` call) until the user explicitly clicks
a location (picking mode or right-click). A waiting message
(`.jakartowns-viewer-panorama-waiting`) is shown as an overlay on the
panorama area until an image is loaded (`!currentImageId`), prompting the
user to click "Click on the map".

An initial position is still passed if the user already picked one during
the current session (e.g. after a logout/login following a first click) — in
that case it's applied inside a `requestAnimationFrame` rather than
synchronously, since a strictly synchronous initial `setPosition()` sometimes
appeared to run before Jakartowns finished its internal setup (same class of
timing issue as the canvas-resize fix — see
[`../specs/jakartowns-integration.md`](../specs/jakartowns-integration.md)).

## Consequences

- No panorama is shown until the user acts — this is the correct behavior
  given Jakarto's limited geographic coverage, not a regression.
- The `requestAnimationFrame` deferral for the "already have a position"
  case is a plausible fix for the timing issue but was not confirmed with
  100% certainty against a live Jakartowns instance; see
  [`../known-issues.md`](../known-issues.md).
