# 0014 — Reassert heading against repeated auto-rotation clobbers

- Date: 2026-07-13
- Status: Accepted

## Context

[ADR-0012](0012-heading-towards-clicked-point-after-locate.md) and
[ADR-0013](0013-reimplement-orientation-preservation-on-image-switch.md)
apply a corrective `setPan` once, in reaction to the `position` event that
follows a locate/image-switch — reasoned, from reading `Viewer.vue`'s
`uid()` watcher, to always fire strictly after the internal auto-rotation
clobber (`state.observer.autoRotation`, always left `true` by the public
API) has already resolved, making a single post-hoc correction reliably win.

In practice, verified against a live linked map, the single-shot correction
did not hold for the multipass timeline case. The exact mechanism wasn't
pinned down with full confidence from static reading alone — plausible
contributors include additional asynchronous steps in the `uid()` watcher's
promise chain (`buildPanos`, `reprojectMeasures`, `correctVisibleCoordinates`,
`showMarkersAround`) that could still touch the camera after `position`
fires, in ways not fully traced.

## Decision

Rather than keep chasing the exact timing, `onOrientationChange` (already
invoked on every `rotation`/`fov` event, previously only used to drive the
map's orientation indicator) now also reasserts the pending heading: for up
to 800ms after a locate/switch, any reported pan that differs from the
intended one (beyond a small tolerance, comparing via
`lib/bearing.ts#angularDifference` to handle the 0/2π wraparound correctly)
is immediately corrected with another `setPan` call. The 800ms window keeps
watching even after a match, since that match may just be the synchronous
echo of our own `setPan` call rather than confirmation that a later,
independent clobber won't still land — the window only ends on timeout, not
on the first success.

800ms was chosen as long enough to outlast the internal transition (a
"fast" one, per the jakartowns-viewer source, so likely a few hundred ms),
while being short enough to limit how long a genuine user-initiated drag
started right after a switch could get fought — the mechanism cannot
distinguish "internal clobber" from "user is dragging" purely from the
`rotation` event stream, so this window is a deliberate trade-off, not
risk-free.

## Consequences

- More resilient to the exact internal timing than a single-shot
  correction, at the cost of a short window (≤800ms) where dragging inside
  the panorama immediately after a locate/switch could visibly fight the
  correction before settling.
- `pendingHeadingRef`/`pendingHeadingDeadlineRef` unify what were
  previously two separate refs (`pendingHeadingTargetRef`, `pendingPanRef`)
  into one discriminated union, since both cases now need the same
  reassertion loop.
- If the underlying timing is later fully root-caused, this reassertion
  loop could potentially be simplified back to a single-shot correction —
  not attempted here since the priority was a working result, not a
  minimal one.
