# 0013 — Reimplement camera orientation preservation on multipass image switch

- Date: 2026-07-13
- Status: Accepted (supersedes ADR-0010)

## Context

[ADR-0010](0010-revert-orientation-preservation-on-image-switch.md) removed
a feature (`lib/lookAt.ts`) that tried to preserve the camera's look-at
point when switching between multipass images at the same location: project
a point ~20m ahead of the current view, then re-aim at it via `setPan(...)`
once the new image loads. It "did not behave as expected" and was reverted
without being root-caused.

[ADR-0012](0012-heading-towards-clicked-point-after-locate.md) since
identified the actual mechanism: the Jakartowns API's `updatePosition`
mutation (used by both `setPosition` *and* `setImage` — `vueApp.setImage`
in `jakartowns_api.js` commits `updatePosition({ uid })` the exact same
way) leaves `state.observer.autoRotation` at its default `true`, so
`Viewer.vue`'s `uid()` watcher auto-rotates to the sphere's own default
heading and overwrites any pan set beforehand — but always *before* the
`position` event fires. So the original `lookAt.ts` idea (re-aim after the
switch) was sound; it just needed to react to `position`, which the widget
now does for picking/right-click (ADR-0012) via `pendingHeadingTargetRef`.

An initial attempt at reapplying this ported the original `lookAt.ts`
approach almost as-is: project a synthetic point ~20m ahead of the current
view (assuming that's roughly where the subject is), then compute a new
bearing from the new position towards that point. A round-trip test
(project ahead, then re-derive the bearing back) surfaced a real,
independent bug: the "production" bearing formula (`getAngleFromPoints`,
ported as-is in ADR-0012) only computes a correct bearing along cardinal
directions — it uses raw lat/lng differences without correcting for
longitude degrees being shorter than latitude degrees away from the
equator (`cos(latitude)` foreshortening), drifting off-axis diagonally
(confirmed numerically: ~55° instead of a true 45° at this codebase's test
latitude). `getJakartownsPanTowards` was fixed to the standard
forward-azimuth formula (curvature-correct), still matching the old one on
cardinal directions — this fix stands regardless of what follows below,
since ADR-0012's right-click case uses it directly.

But the ~20m assumption itself doesn't hold up under scrutiny: `pan` is
already an **absolute** compass bearing (0 = North), not relative to any
position. For a subject far away relative to the (typically few-meter)
separation between two multipass captures, the bearing from either capture
towards it is nearly identical regardless of the actual distance — in the
limit of a distant subject, the correct answer is exactly "keep the same
pan", with no assumed distance at all. Projecting a synthetic point ahead
and re-deriving a bearing from it only reintroduces error proportional to
how wrong the assumed 20m is, for no benefit over the simpler answer.

## Decision

Drop the point-projection approach entirely for this case. `handleSelectImage`
now just reads the current pan via `getViewState()` and carries it forward
via a new `pendingPanRef`, consumed by the same `position`-event handler
that drives `pendingHeadingTargetRef` (ADR-0012) but applied directly with
`setPan` — no bearing computation needed. `lib/bearing.ts`'s `projectPoint`
and `LOOK_AHEAD_DISTANCE_METERS` were removed as a result (no remaining
caller); `getJakartownsPanTowards`'s curvature-correct fix and
`reflectAngle` stay, since ADR-0012's right-click/picking-mode case still
needs an actual point-to-point bearing.

## Consequences

- Switching between multipass images at the same location now keeps
  looking in the same compass direction instead of resetting to the new
  sphere's default orientation.
- Still an approximation, now a different one: exact for a subject far
  from the capture points (the common case — buildings, signs, streets),
  degrades for something within a few meters of the camera. No longer
  depends on guessing how far the subject actually is.
