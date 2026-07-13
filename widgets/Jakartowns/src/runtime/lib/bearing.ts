/**
 * lib/bearing.ts
 *
 * The public Jakartowns JS API's `setPosition` briefly sets the correct
 * look-at pan itself, then clobbers it: `updatePosition({ uid })` (no
 * `autoRotation: false`, unlike the app's own internal navigation) leaves
 * `state.observer.autoRotation` at its default `true`, so the panorama then
 * auto-rotates to the sphere's own default heading and re-commits that over
 * ours — confirmed by reading the relevant watcher in Jakartowns' own
 * client-side source. This computes the pan needed, from the actual
 * (relocated) position, to look towards the point the user actually
 * clicked — applied by the widget *after* that internal clobber has
 * already happened (see widget.tsx).
 */

import { type JakartoPosition } from '../services/jakarto'

/**
 * Pan (Jakartowns convention: 0 = North, π/2 = West — see
 * buildJakartownsUrl in services/jakarto.ts) to look from `from` towards
 * `to`. Standard forward-azimuth ("initial bearing") formula on a sphere,
 * converted to Jakartowns' convention via `reflectAngle`.
 *
 * NOT the same formula as `getAngleFromPoints` in the asset-viewer (or the
 * Jakartowns API's own internal `vueApp.setPosition`), which use raw
 * lat/lng differences without correcting for longitude degrees being
 * foreshortened by cos(latitude): that only matches a true bearing along
 * cardinal directions and drifts off-axis for diagonal ones (confirmed
 * numerically — e.g. ~55° instead of 45° at this codebase's ~45°N test
 * latitude). This version stays exact at any bearing.
 */
export function getJakartownsPanTowards(from: JakartoPosition, to: JakartoPosition): number {
  const lat1 = (from.latitude * Math.PI) / 180
  const lat2 = (to.latitude * Math.PI) / 180
  const deltaLng = ((to.longitude - from.longitude) * Math.PI) / 180

  const bearing = Math.atan2(
    Math.sin(deltaLng) * Math.cos(lat2),
    Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng)
  )
  return reflectAngle(bearing)
}

/**
 * Converts between Jakartowns' pan convention (0 = North, counter-clockwise)
 * and a standard compass bearing (0 = North, clockwise), or back — this is
 * a plain reflection across the North/South axis, so the same formula works
 * both ways. Verified numerically against North/East/West/South cases
 * before use.
 */
export function reflectAngle(angleRadians: number): number {
  const twoPi = 2 * Math.PI
  return ((twoPi - angleRadians) % twoPi + twoPi) % twoPi
}

/**
 * Shortest signed distance between two angles (radians), wrapping correctly
 * across the 0/2π boundary — e.g. the difference between 0 and 2π-0.001 is
 * ~0.001, not ~2π. Used to detect whether an observed pan still needs
 * correcting towards a target one, regardless of which side of North it
 * wrapped around from.
 */
export function angularDifference(a: number, b: number): number {
  const twoPi = 2 * Math.PI
  return (((a - b + Math.PI) % twoPi + twoPi) % twoPi) - Math.PI
}
