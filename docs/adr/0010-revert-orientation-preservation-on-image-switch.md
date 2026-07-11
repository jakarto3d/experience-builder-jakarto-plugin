# 0010 — Revert camera orientation preservation on multipass image switch

- Date: 2026-07-10
- Status: Accepted (reverses a shipped feature)

## Context

A feature was implemented (`src/runtime/lib/lookAt.ts`) to preserve the
camera's look-at point when switching between multipass images at the same
location: before switching, it computed a point ~20m ahead of the current
view (heading derived from the Jakartowns pan angle, validated numerically
against two North/East test cases), then re-oriented the camera toward that
same point via `setPan(...)` once the new image loaded. The final pan
calculation reused a `getAngleFromPoints` helper already validated and used
in production elsewhere, rather than re-deriving the math by hand.

In practice, this did not behave as expected once tested.

## Decision

Remove `lookAt.ts` and the associated look-at computation entirely. `setPan`
was also removed from `JakartoViewerHandle` (it became unused). The user now
re-orients manually after switching images in the multipass timeline.

## Consequences

- Switching between multipass images at the same location does not attempt
  to preserve the camera's orientation; the view resets to whatever the
  newly loaded image's default orientation is.
- This freed up the title bar's layout for the picking-mode and
  "Open in Jakartowns" buttons, folded into it as icon buttons in the same
  change (see [`../specs/interaction-behavior.md`](../specs/interaction-behavior.md)).
- If look-at preservation is revisited later, the numerically-validated angle
  math is recoverable from Git history (commit `cf34c3b`) as a starting
  point — but the reason it didn't work as expected was not root-caused
  before reverting, so it would need re-investigation, not just restoring
  the old code.
