/**
 * Reproduces the "Observer Icon" from @jakarto3d/jakui (Vue component
 * `V2ObserverIcon`, dist/jakui.es.js): a gradient dot (position) + a
 * gradient arc (field of view), ported as-is including its dasharray/
 * dashoffset arc geometry and "shadow" arc depth effect.
 *
 * The generated SVG points up (North); heading rotation is applied
 * separately via ArcGIS's `PictureMarkerSymbol.angle` (see widget.tsx) so
 * the image only needs regenerating when the fov changes, not on every
 * heading micro-rotation.
 */

// --ds-color-observer-* tokens from @jakarto3d/jakui (light theme, values
// copied from node_modules/@jakarto3d/jakui/dist/tokens/semantic.css — the
// package itself isn't loaded in Experience Builder).
const DOT_START = 'hsl(281, 42%, 37%)' // --ds-color-purple-500
const DOT_END = 'hsl(212, 49%, 38%)' // --ds-color-primary-500
const ARC_INNER = 'hsl(212, 49%, 38%)' // --ds-color-primary-500
const ARC_OUTER = 'hsl(133, 32%, 43%)' // --ds-color-green-500
const ARC_SHADOW = 'hsl(212, 49%, 38%)' // --ds-color-primary-500

// Same defaults as V2ObserverIcon.
export const OBSERVER_ICON_SIZE = 48
const DOT_RADIUS = 5
const ARC_RADIUS = 14
const STROKE_WIDTH = 6
export const DEFAULT_OBSERVER_FOV = 60
// Fraction of a full turn corresponding to "up" (North): used to offset the
// start of the stroke so the visible arc is centered on it.
const QUARTER_TURN_RATIO = 0.25
// The "shadow" arc is slightly shorter than the main arc, for the depth effect.
const SHADOW_ARC_LENGTH_RATIO = 0.9

export function buildObserverIconSvg(fovDegrees: number): string {
  const half = OBSERVER_ICON_SIZE / 2
  const fov = Math.min(360, Math.max(0, fovDegrees))

  const innerR = Math.max(0, ARC_RADIUS - STROKE_WIDTH / 2)
  const outerR = ARC_RADIUS + STROKE_WIDTH / 2
  const innerStopPercent = outerR <= 0 ? 0 : (innerR / outerR) * 100

  const circumference = 2 * Math.PI * ARC_RADIUS
  const arcLength = circumference * (fov / 360)
  // Offsets the start of the stroke to center the visible arc on "up"
  // (North): a quarter turn plus half the arc's angular span.
  const dashOffsetMain = circumference * (QUARTER_TURN_RATIO + fov / 720)
  const gapLength = Math.max(0, circumference - arcLength)

  const shadowArcLength = arcLength * SHADOW_ARC_LENGTH_RATIO
  const shadowDashOffset = circumference * QUARTER_TURN_RATIO + shadowArcLength / 2
  const shadowGapLength = Math.max(0, circumference - shadowArcLength)

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${OBSERVER_ICON_SIZE}" height="${OBSERVER_ICON_SIZE}" viewBox="${-half} ${-half} ${OBSERVER_ICON_SIZE} ${OBSERVER_ICON_SIZE}">
  <defs>
    <linearGradient id="dot" gradientUnits="userSpaceOnUse" x1="0" y1="${DOT_RADIUS}" x2="0" y2="${-DOT_RADIUS}">
      <stop offset="0%" stop-color="${DOT_START}" />
      <stop offset="100%" stop-color="${DOT_END}" />
    </linearGradient>
    <radialGradient id="arc" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="${outerR}">
      <stop offset="0%" stop-color="${ARC_INNER}" />
      <stop offset="${innerStopPercent}%" stop-color="${ARC_INNER}" />
      <stop offset="100%" stop-color="${ARC_OUTER}" />
    </radialGradient>
  </defs>
  <circle cx="0" cy="0" r="${DOT_RADIUS}" fill="url(#dot)" />
  <circle cx="0" cy="0" r="${ARC_RADIUS}" fill="none" stroke="${ARC_SHADOW}" stroke-width="${STROKE_WIDTH}" stroke-linecap="butt" stroke-dasharray="${shadowArcLength} ${shadowGapLength}" stroke-dashoffset="${shadowDashOffset}" />
  <circle cx="0" cy="0" r="${ARC_RADIUS}" fill="none" stroke="url(#arc)" stroke-width="${STROKE_WIDTH}" stroke-linecap="round" stroke-dasharray="${arcLength} ${gapLength}" stroke-dashoffset="${dashOffsetMain}" />
</svg>`
}

export function buildObserverIconDataUrl(fovDegrees: number): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(buildObserverIconSvg(fovDegrees))}`
}
