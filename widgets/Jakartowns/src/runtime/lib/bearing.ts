/**
 * lib/bearing.ts
 *
 * The public Jakartowns JS API's `setPosition` briefly sets the correct
 * look-at pan itself, then clobbers it: `updatePosition({ uid })` (no
 * `autoRotation: false`, unlike the app's own internal navigation) leaves
 * `state.observer.autoRotation` at its default `true`, so the panorama then
 * auto-rotates to the sphere's own default heading and re-commits that over
 * ours — confirmed by reading `Viewer.vue`'s `uid()` watcher in the
 * jakartowns-viewer source. This computes the pan needed, from the actual
 * (relocated) position, to look towards the point the user actually
 * clicked — applied by the widget *after* that internal clobber has
 * already happened (see widget.tsx).
 */

import { type JakartoPosition } from '../services/jakarto'

/**
 * Pan (Jakartowns convention: 0 = North, π/2 = West — see
 * buildJakartownsUrl in services/jakarto.ts) to look from `from` towards
 * `to`. Ported as-is from `getAngleFromPoints` in a production Jakarto app
 * (the asset-viewer, already using it to orient the camera towards a
 * targeted point via `setPan(...)`) and matches the Jakartowns API's own
 * `vueApp.setPosition` formula, rather than re-derived by hand — avoids a
 * sign/convention mistake. Verified numerically against North/West/South/
 * East cases.
 */
export function getJakartownsPanTowards(from: JakartoPosition, to: JakartoPosition): number {
  const dy = from.latitude - to.latitude
  const dx = from.longitude - to.longitude
  return Math.PI + Math.atan2(-dx, dy)
}
