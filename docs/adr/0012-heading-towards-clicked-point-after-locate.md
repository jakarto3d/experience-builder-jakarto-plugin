# 0012 — Orient heading towards the clicked point after picking/right-click

- Date: 2026-07-13
- Status: Accepted

## Context

Picking mode and right-click both relocate the panorama via `setPosition`,
which snaps to the nearest available panorama sphere near the clicked
point — not necessarily exactly on it.

The public Jakartowns JS API's own `setPosition` *does* attempt to face the
clicked point by default (`keepPreviousAngles: false`): it computes a pan
angle from the actual nearest-sphere position towards the requested
lat/lng and commits it to the store. In practice this had no visible
effect — confirmed by reading the actual `jakartowns-viewer` source
(`src/api/v1/jakartowns_api.js` and `src/components/Viewer.vue`):

- `vueApp.setPosition` commits `updatePosition({ uid })` **without**
  `autoRotation: false` — unlike every internal caller in the app itself
  (marker clicks, `goToLocation`), which always passes it explicitly. So
  `state.observer.autoRotation` stays at its default, `true`.
- `state.uid`'s Vue watcher (`Viewer.vue`'s `uid()`) then calls
  `global.panorama.moveToImageUID(uid, { withRotation: state.observer.autoRotation })`.
  With `autoRotation: true`, this auto-rotates the camera to the sphere's
  own default heading, then re-commits `updateRotation` with that value —
  clobbering the pan `setPosition` had just computed.
- Only *after* that whole chain resolves does the watcher commit
  `updatingPosition(false)`, which is what actually dispatches the
  `position` `CustomEvent` this widget listens to (`onViewChange`).

So the public API has no option to prevent this auto-rotation, but the
clobber is always fully resolved *before* the `position` event fires —
meaning a `setPan` call made in reaction to that event is chronologically
last and reliably wins.

[ADR-0010](0010-revert-orientation-preservation-on-image-switch.md) removed
a similar heading computation (`lib/lookAt.ts`) for a different trigger
(preserving the look-at point across a multipass image switch) without
root-causing why it "didn't behave as expected". This is the same
underlying mechanism at play there too, most likely.

## Decision

On picking-mode click or right-click, store the clicked lat/lng as a
pending heading target (`pendingHeadingTargetRef`). Once the next
`position` event confirms the viewer's actual (relocated) position,
compute the pan via `getJakartownsPanTowards(newPosition, target)`
(`lib/bearing.ts` — the same formula the Jakartowns API itself uses
internally, verified against `useJakartownsApi.js`/`getAngleFromPoints` in
the asset-viewer and against `jakartowns_api.js`'s own `setPosition`) and
apply it with `setPan`, then clear the pending target.

`setPan` is re-added to `JakartoViewerHandle` for this.

## Consequences

- Picking mode and right-click now turn the panorama to face the clicked
  point once it loads, instead of the sphere's auto-rotated default
  orientation.
- This is a one-shot adjustment, not a persistent lock: it doesn't keep
  re-aiming at that point as the user navigates further inside the
  panorama (consistent with
  [ADR-0005](0005-no-auto-recenter-on-panorama-navigation.md)'s
  one-way-sync philosophy).
- If this needs revisiting, `Viewer.vue`'s `uid()` watcher in the
  jakartowns-viewer source is the reference to re-check against.
